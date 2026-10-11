#!/usr/bin/env bash
# Simulator helpers. Source after common.sh.
# SIM_DEVICE: preferred device name (default "iPhone 17").

# Prints the UDID of the preferred Simulator, falling back to the first
# available iPhone. Dies when none exists.
resolve_sim_udid() {
  local want="${SIM_DEVICE:-iPhone 17}" json udid
  json="$(xcrun simctl list devices available -j)" || die "simctl list failed"
  udid="$(printf '%s' "$json" | WANT="$want" node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const all = Object.values(JSON.parse(s).devices).flat();
      const phones = all.filter((d) => d.isAvailable !== false && /^iPhone/.test(d.name));
      const hit = phones.find((d) => d.name === process.env.WANT) || phones[0];
      process.stdout.write(hit ? hit.udid : "");
    });')"
  [ -n "$udid" ] || die "no available iPhone Simulator found"
  printf '%s\n' "$udid"
}

# Idempotent boot; waits until the device is fully booted.
boot_sim() {
  local udid="$1" state
  state="$(xcrun simctl list devices -j | UDID="$udid" node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const d = Object.values(JSON.parse(s).devices).flat().find((x) => x.udid === process.env.UDID);
      process.stdout.write(d ? d.state : "");
    });')"
  if [ "$state" != "Booted" ]; then
    xcrun simctl boot "$udid" || die "could not boot Simulator $udid"
  fi
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || die "Simulator $udid did not finish booting"
}
