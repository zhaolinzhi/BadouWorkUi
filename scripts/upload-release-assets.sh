#!/usr/bin/env bash
# Upload local release metadata/assets to the BadouWork release server.
#
# Preferred local layout:
#   <LOCAL_DIR>/yml/*.yml
#   <LOCAL_DIR>/zip/*.zip
#   <LOCAL_DIR>/<version>/
# A flat <LOCAL_DIR> with *.yml / *.zip directly inside it still works.
#
# Destinations:
#   yml/*.yml            -> /data/badouworkreleases/versions/releases/
#   <version subfolder>/ -> /data/badouworkreleases/versions/releases/
#   zip/*.zip            -> /data/badouworkreleases/versions/
#
# Zips are renamed to "<prefix>-latest.zip" before upload, e.g.
#   macos-build-x64-1e3165f.zip -> macos-build-x64-latest.zip
#
# Failures are collected and reported at the end; remaining files are still
# uploaded. The exit code is non-zero if anything failed.
#
# The SSH password is entered manually. The script opens one ControlMaster
# connection so the password is only prompted once for all uploads.
#
# Usage:
#   bash scripts/upload-release-assets.sh [LOCAL_DIR] [VERSION_SUBFOLDER]
#   bash scripts/upload-release-assets.sh out 1.0.0
#
# Environment overrides:
#   HOST=192.168.1.242
#   SSH_USER=root
#   REMOTE_BASE=/data/badouworkreleases/versions
#   YML_DIR=<path>   default: <LOCAL_DIR>/yml (falls back to <LOCAL_DIR>)
#   ZIP_DIR=<path>   default: <LOCAL_DIR>/zip (falls back to <LOCAL_DIR>)
#   DRY_RUN=1        print what would happen without touching SSH or local files

set -uo pipefail

HOST="${HOST:-192.168.1.242}"
SSH_USER="${SSH_USER:-root}"
REMOTE_BASE="${REMOTE_BASE:-/data/badouworkreleases/versions}"
LOCAL_DIR="${1:-$(pwd)}"
SUBFOLDER="${2:-${SUBFOLDER:-}}"
DRY_RUN="${DRY_RUN:-0}"

REMOTE_RELEASES_DIR="${REMOTE_BASE}/releases"
FAILURES=()

log() { printf '[upload] %s\n' "$*"; }
die() { printf '[upload] ERROR: %s\n' "$*" >&2; exit 1; }
record_failure() {
  FAILURES+=("$1")
  printf '[upload] FAILED: %s\n' "$1" >&2
}

[ -d "$LOCAL_DIR" ] || die "Local directory does not exist: $LOCAL_DIR"
LOCAL_DIR="$(cd "$LOCAL_DIR" && pwd)"

# Convenience: running from the repo root usually means the artifacts live in out/.
shopt -s nullglob
initial_yml=("$LOCAL_DIR"/*.yml)
shopt -u nullglob
if [ ! -d "$LOCAL_DIR/yml" ] && [ "${#initial_yml[@]}" -eq 0 ] && [ -d "$LOCAL_DIR/out" ]; then
  shopt -s nullglob
  out_yml=("$LOCAL_DIR/out"/*.yml)
  shopt -u nullglob
  if [ "${#out_yml[@]}" -gt 0 ]; then
    log "No *.yml in $LOCAL_DIR; using $LOCAL_DIR/out"
    LOCAL_DIR="$LOCAL_DIR/out"
  fi
fi

# Prefer the dedicated subfolders the release bundle uses, but keep working
# with a flat directory for backwards compatibility.
YML_SOURCE_DIR="${YML_DIR:-$LOCAL_DIR/yml}"
if [ ! -d "$YML_SOURCE_DIR" ]; then
  YML_SOURCE_DIR="$LOCAL_DIR"
fi
ZIP_SOURCE_DIR="${ZIP_DIR:-$LOCAL_DIR/zip}"
ZIP_SOURCE_IS_DEDICATED=1
if [ ! -d "$ZIP_SOURCE_DIR" ]; then
  ZIP_SOURCE_DIR="$LOCAL_DIR"
  ZIP_SOURCE_IS_DEDICATED=0
fi

# Resolve the version subfolder without aborting on failure: yml/zip uploads can
# still proceed when the folder is missing or ambiguous.
resolve_subfolder() {
  if [ -n "$SUBFOLDER" ]; then
    if [ ! -d "$LOCAL_DIR/$SUBFOLDER" ]; then
      record_failure "Subfolder not found: $LOCAL_DIR/$SUBFOLDER"
      SUBFOLDER=""
    fi
    return
  fi

  # Prefer the version declared in a local latest*.yml.
  local version=""
  local file
  for file in "$YML_SOURCE_DIR"/latest*.yml; do
    [ -f "$file" ] || continue
    version="$(sed -n 's/^version:[[:space:]]*//p' "$file" | head -n1 | tr -d "'\"\r")"
    [ -n "$version" ] && break
  done

  if [ -n "$version" ] && [ -d "$LOCAL_DIR/$version" ]; then
    SUBFOLDER="$version"
    return
  fi

  # Fall back to a single semver-looking directory.
  local candidates=()
  while IFS= read -r dir; do
    candidates+=("$(basename "$dir")")
  done < <(find "$LOCAL_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*.[0-9]*.[0-9]*' | sort)

  if [ "${#candidates[@]}" -eq 1 ]; then
    SUBFOLDER="${candidates[0]}"
    return
  fi

  record_failure "Cannot determine the version subfolder; pass it as the second argument, e.g. $0 \"$LOCAL_DIR\" 1.0.0"
  SUBFOLDER=""
}

resolve_subfolder

shopt -s nullglob
yml_candidates=("$YML_SOURCE_DIR"/*.yml)
zip_files=("$ZIP_SOURCE_DIR"/*.zip)
shopt -u nullglob

# builder-debug.yml is electron-builder diagnostics, not updater metadata.
yml_files=()
for file in ${yml_candidates[@]+"${yml_candidates[@]}"}; do
  [ "$(basename "$file")" = 'builder-debug.yml' ] && continue
  yml_files+=("$file")
done

log "Local dir:      $LOCAL_DIR"
log "Yml dir:        $YML_SOURCE_DIR"
log "Zip dir:        $ZIP_SOURCE_DIR"
log "Version folder: ${SUBFOLDER:-(not found)}"
log "Server:         ${SSH_USER}@${HOST}"
log "Remote base:    $REMOTE_BASE"

if [ "${#yml_files[@]}" -eq 0 ]; then
  log "WARN: no *.yml files found in $YML_SOURCE_DIR"
fi
if [ "${#zip_files[@]}" -eq 0 ]; then
  log "WARN: no *.zip files found in $ZIP_SOURCE_DIR"
fi

CONTROL_SOCKET="$(mktemp -u "${TMPDIR:-/tmp}/badouwork-upload.XXXXXX" 2>/dev/null || true)"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-o StrictHostKeyChecking=accept-new)
if [ -n "$CONTROL_SOCKET" ]; then
  SSH_OPTS+=(-o ControlMaster=auto -o ControlPath="$CONTROL_SOCKET" -o ControlPersist=300)
  SCP_OPTS+=(-o ControlPath="$CONTROL_SOCKET")
fi

cleanup() {
  if [ "$DRY_RUN" != "1" ] && [ -n "$CONTROL_SOCKET" ]; then
    ssh "${SSH_OPTS[@]}" -O exit "${SSH_USER}@${HOST}" >/dev/null 2>&1 || true
  fi
  [ -n "$CONTROL_SOCKET" ] && rm -f "$CONTROL_SOCKET"
}
trap cleanup EXIT

if [ "$DRY_RUN" = "1" ]; then
  log "DRY-RUN: no SSH connection or local rename will be performed"
else
  log "Connecting ... enter the ${SSH_USER} password when prompted"
  if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "mkdir -p '${REMOTE_RELEASES_DIR}' '${REMOTE_BASE}'"; then
    log "Connected"
  else
    record_failure "Failed to connect or create remote directories"
  fi
fi

uploaded_yml=0
for file in ${yml_files[@]+"${yml_files[@]}"}; do
  log "Uploading $(basename "$file") -> ${REMOTE_RELEASES_DIR}/"
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN: scp $file -> ${SSH_USER}@${HOST}:${REMOTE_RELEASES_DIR}/"
    uploaded_yml=$((uploaded_yml + 1))
  elif scp "${SCP_OPTS[@]}" "$file" "${SSH_USER}@${HOST}:${REMOTE_RELEASES_DIR}/"; then
    uploaded_yml=$((uploaded_yml + 1))
  else
    record_failure "Failed to upload $(basename "$file")"
  fi
done

uploaded_folder=0
if [ -n "$SUBFOLDER" ]; then
  log "Uploading ${SUBFOLDER}/ -> ${REMOTE_RELEASES_DIR}/${SUBFOLDER}/"
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN: scp -r $LOCAL_DIR/$SUBFOLDER -> ${SSH_USER}@${HOST}:${REMOTE_RELEASES_DIR}/"
    uploaded_folder=1
  elif scp "${SCP_OPTS[@]}" -r "$LOCAL_DIR/$SUBFOLDER" "${SSH_USER}@${HOST}:${REMOTE_RELEASES_DIR}/"; then
    uploaded_folder=1
  else
    record_failure "Failed to upload subfolder $SUBFOLDER/"
  fi
else
  log "Skipping subfolder upload (not resolved)"
fi

uploaded_zips=0
SEEN_TARGETS=$'\n'
for zip_file in ${zip_files[@]+"${zip_files[@]}"}; do
  name="$(basename "$zip_file")"
  base="${name%.zip}"

  # Replace the final "-<suffix>" segment with "-latest". Names that already
  # end in "-latest" are left alone so reruns stay idempotent. In the flat
  # fallback only build artifacts are renamed, so versioned installers placed
  # next to the manifests are not mangled.
  if [ "$ZIP_SOURCE_IS_DEDICATED" = "1" ] || [[ "$base" == *-build-* ]]; then
    if [[ "$base" == *-latest ]]; then
      target="$name"
    elif [[ "$base" == *-* ]]; then
      target="${base%-*}-latest.zip"
    else
      target="${base}-latest.zip"
    fi
  else
    target="$name"
  fi

  # Multiple downloaded builds for the same platform/arch collapse to the same
  # target; surface it instead of silently overwriting the earlier file.
  if [[ "$SEEN_TARGETS" == *$'\n'"$target"$'\n'* ]]; then
    record_failure "Duplicate zip target $target (from $name); skipping"
    continue
  fi

  if [ "$target" != "$name" ]; then
    if [ "$DRY_RUN" = "1" ]; then
      log "DRY-RUN: rename locally $name -> $target"
    else
      log "Renaming locally: $name -> $target"
      if ! mv -f "$zip_file" "$ZIP_SOURCE_DIR/$target"; then
        record_failure "Failed to rename $name"
        continue
      fi
    fi
    zip_file="$ZIP_SOURCE_DIR/$target"
  fi
  SEEN_TARGETS+="$target"$'\n'

  log "Uploading $target -> ${REMOTE_BASE}/${target}"
  if [ "$DRY_RUN" = "1" ]; then
    log "DRY-RUN: scp $zip_file -> ${SSH_USER}@${HOST}:${REMOTE_BASE}/${target}"
    uploaded_zips=$((uploaded_zips + 1))
  elif scp "${SCP_OPTS[@]}" "$zip_file" "${SSH_USER}@${HOST}:${REMOTE_BASE}/${target}"; then
    uploaded_zips=$((uploaded_zips + 1))
  else
    record_failure "Failed to upload $target"
  fi
done

log "Uploaded: ${uploaded_yml} yml file(s), ${uploaded_folder} folder(s), ${uploaded_zips} zip file(s)."
if [ "${#FAILURES[@]}" -gt 0 ]; then
  log "Completed with ${#FAILURES[@]} failure(s):"
  for failure in ${FAILURES[@]+"${FAILURES[@]}"}; do
    log "  - $failure"
  done
  exit 1
fi
log "Done."
