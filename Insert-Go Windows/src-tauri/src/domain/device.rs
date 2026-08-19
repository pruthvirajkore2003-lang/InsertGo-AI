//! Logic for generating a unique hardware ID to bind the account.

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

/// Retrieve a unique machine identifier.
/// On Windows, this reads `MachineGuid` from `HKLM\SOFTWARE\Microsoft\Cryptography`.
/// On other platforms, it returns a placeholder.
#[tauri::command]
pub fn get_hardware_id() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let crypto = hklm
            .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
            .map_err(|e| format!("Failed to open registry key: {}", e))?;

        let guid: String = crypto
            .get_value("MachineGuid")
            .map_err(|e| format!("Failed to read MachineGuid: {}", e))?;

        Ok(guid)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Fallback for non-Windows platforms (e.g. dev/testing on macOS/Linux)
        Ok("non-windows-dev-device-id".to_string())
    }
}
