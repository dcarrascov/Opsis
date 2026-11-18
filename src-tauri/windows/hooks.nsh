; Regla del firewall para UxPlay (perfil Privado) al instalar, y borrado al desinstalar.
; Por eso el instalador es perMachine (necesita permisos de administrador).

!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Opsis (UxPlay)" dir=in action=allow program="$INSTDIR\uxplay.exe" enable=yes profile=private'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Opsis (UxPlay)"'
!macroend
