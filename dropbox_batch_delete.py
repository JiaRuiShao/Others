#!/usr/bin/env python3
"""
Batch delete photos from Dropbox.
Handles the 1000-item API limit by chunking deletions automatically.

Usage:
    python dropbox_batch_delete.py --token YOUR_TOKEN --folder /Photos
    python dropbox_batch_delete.py --token YOUR_TOKEN --folder /Photos --extensions jpg jpeg png gif heic
    python dropbox_batch_delete.py --token YOUR_TOKEN --file-list files.txt
"""

import argparse
import time
import sys
import requests

DROPBOX_API = "https://api.dropboxapi.com/2"
BATCH_SIZE = 1000


def list_photos(token: str, folder: str, extensions: list[str]) -> list[str]:
    """List all files in a Dropbox folder matching given extensions."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    paths = []
    cursor = None

    # Dropbox uses "" for root, not "/"
    if folder == "/":
        folder = ""

    print(f"Listing files in '{folder or '/'}' ...")

    while True:
        if cursor is None:
            url = f"{DROPBOX_API}/files/list_folder"
            data = {"path": folder, "recursive": True, "limit": 2000}
        else:
            url = f"{DROPBOX_API}/files/list_folder/continue"
            data = {"cursor": cursor}

        resp = requests.post(url, headers=headers, json=data)
        if not resp.ok:
            print(f"API error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        result = resp.json()

        for entry in result.get("entries", []):
            if entry[".tag"] == "file":
                name = entry["name"].lower()
                if any(name.endswith(f".{ext.lower()}") for ext in extensions):
                    paths.append(entry["path_lower"])

        if not result.get("has_more"):
            break
        cursor = result["cursor"]

    return paths


def read_paths_from_file(file_path: str) -> list[str]:
    """Read Dropbox paths from a text file (one path per line)."""
    with open(file_path) as f:
        return [line.strip() for line in f if line.strip()]


def read_paths_from_json(json_file: str) -> list[str]:
    """Read paths from a JSON file in Dropbox batch delete payload format.

    Accepts: {"entries": [{"path": "id:xxx"}, ...]}
    """
    import json
    with open(json_file) as f:
        data = json.load(f)
    entries = data.get("entries", [])
    return [e["path"] for e in entries if "path" in e]


def delete_batch(token: str, paths: list[str], dry_run: bool) -> int:
    """Delete files in batches of up to BATCH_SIZE. Returns total deleted count."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    total_deleted = 0

    for i in range(0, len(paths), BATCH_SIZE):
        chunk = paths[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (len(paths) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\nBatch {batch_num}/{total_batches}: deleting {len(chunk)} files...")

        if dry_run:
            for p in chunk:
                print(f"  [dry-run] would delete: {p}")
            total_deleted += len(chunk)
            continue

        # Start async batch delete
        entries = [{"path": p} for p in chunk]
        resp = requests.post(
            f"{DROPBOX_API}/files/delete_batch",
            headers=headers,
            json={"entries": entries},
        )
        if not resp.ok:
            print(f"API error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        result = resp.json()

        # Poll until complete if async
        if result.get(".tag") == "async_job_id":
            job_id = result["async_job_id"]
            print(f"  Waiting for batch job {job_id} to complete...")
            while True:
                time.sleep(2)
                check = requests.post(
                    f"{DROPBOX_API}/files/delete_batch/check",
                    headers=headers,
                    json={"async_job_id": job_id},
                )
                check.raise_for_status()
                check_result = check.json()
                tag = check_result.get(".tag")
                if tag == "complete":
                    entries_result = check_result.get("entries", [])
                    succeeded = sum(1 for e in entries_result if e.get(".tag") == "success")
                    failed = sum(1 for e in entries_result if e.get(".tag") == "failure")
                    total_deleted += succeeded
                    print(f"  Done: {succeeded} deleted, {failed} failed")
                    if failed:
                        for e in entries_result:
                            if e.get(".tag") == "failure":
                                print(f"    Failed: {e}")
                    break
                elif tag == "failed":
                    print(f"  Batch job failed: {check_result}")
                    break
                else:
                    print(f"  Status: {tag}, waiting...")
        elif result.get(".tag") == "complete":
            entries_result = result.get("entries", [])
            succeeded = sum(1 for e in entries_result if e.get(".tag") == "success")
            total_deleted += succeeded
            print(f"  Done: {succeeded} deleted")

    return total_deleted


def main():
    parser = argparse.ArgumentParser(description="Batch delete photos from Dropbox")
    parser.add_argument("--token", required=True, help="Dropbox API access token")
    parser.add_argument("--folder", help="Dropbox folder path to scan (e.g. /Photos)")
    parser.add_argument(
        "--extensions",
        nargs="+",
        default=["jpg", "jpeg", "png", "gif", "heic", "webp", "bmp", "tiff", "raw", "cr2", "nef"],
        help="File extensions to delete (default: common photo formats)",
    )
    parser.add_argument(
        "--file-list",
        help="Text file with one Dropbox path per line to delete",
    )
    parser.add_argument(
        "--json",
        dest="json_payload",
        help='JSON file in Dropbox batch delete format: {"entries":[{"path":"id:xxx"},...]}',
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be deleted without actually deleting",
    )
    args = parser.parse_args()

    if not args.folder and not args.file_list and not args.json_payload:
        print("Error: provide --folder, --file-list, or --json")
        sys.exit(1)

    if args.json_payload:
        paths = read_paths_from_json(args.json_payload)
        print(f"Loaded {len(paths)} paths from {args.json_payload}")
    elif args.file_list:
        paths = read_paths_from_file(args.file_list)
        print(f"Loaded {len(paths)} paths from {args.file_list}")
    else:
        paths = list_photos(args.token, args.folder, args.extensions)
        print(f"Found {len(paths)} matching files")

    if not paths:
        print("Nothing to delete.")
        return

    if args.dry_run:
        print(f"\n[DRY RUN] Would delete {len(paths)} files in {((len(paths)-1)//BATCH_SIZE)+1} batch(es).")
    else:
        confirm = input(f"\nAbout to delete {len(paths)} files. Type 'yes' to confirm: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

    deleted = delete_batch(args.token, paths, dry_run=args.dry_run)
    print(f"\nTotal deleted: {deleted}")


if __name__ == "__main__":
    main()
