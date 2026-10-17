# HushRP firewall rule is limited to Private profile, selected TCP port, local subnet scope.
$rule = Get-NetFirewallRule -DisplayName 'HushRP Home LAN' -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -DisplayName 'HushRP Home LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $env:HUSHRP_PORT -Profile Private -RemoteAddress LocalSubnet | Out-Null
} else {
  Set-NetFirewallRule -InputObject $rule -Enabled True -Profile Private -Direction Inbound -Action Allow
  $rule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $env:HUSHRP_PORT
  $rule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet
}
