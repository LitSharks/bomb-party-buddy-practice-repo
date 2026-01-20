using System;
using System.Linq;
using System.Management;
using Microsoft.Win32;

namespace SecuritySettingsViewer;

public enum SettingState
{
    Unknown,
    Disabled,
    Enabled
}

public static class SecurityChecker
{
    public static SettingState GetRealTimeProtectionState()
    {
        var wmiState = GetDefenderRealTimeFromWmi();
        if (wmiState != SettingState.Unknown)
        {
            return wmiState;
        }

        using var key = Registry.LocalMachine.OpenSubKey(
            @"SOFTWARE\Microsoft\Windows Defender\Real-Time Protection");
        var value = key?.GetValue("DisableRealtimeMonitoring");
        if (value is int intValue)
        {
            return intValue == 1 ? SettingState.Disabled : SettingState.Enabled;
        }

        return SettingState.Unknown;
    }

    public static SettingState GetDriverBlocklistState()
    {
        using var key = Registry.LocalMachine.OpenSubKey(
            @"SYSTEM\CurrentControlSet\Control\CI\Config");
        var value = key?.GetValue("VulnerableDriverBlocklistEnable");
        if (value is int intValue)
        {
            return intValue == 1 ? SettingState.Enabled : SettingState.Disabled;
        }

        return SettingState.Unknown;
    }

    public static SettingState GetSecureBootState()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                @"root\Microsoft\Windows\HardwareManagement",
                "SELECT * FROM MSFT_SecureBoot");
            var result = searcher.Get().Cast<ManagementObject>().FirstOrDefault();
            var value = result?["SecureBootEnabled"];
            if (value is bool enabled)
            {
                return enabled ? SettingState.Enabled : SettingState.Disabled;
            }
        }
        catch
        {
            return SettingState.Unknown;
        }

        return SettingState.Unknown;
    }

    public static SettingState GetHyperVState()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT * FROM Win32_OptionalFeature WHERE Name = 'Microsoft-Hyper-V'");
            var feature = searcher.Get().Cast<ManagementObject>().FirstOrDefault();
            if (feature != null && feature["InstallState"] is int state)
            {
                return state == 1 ? SettingState.Enabled : SettingState.Disabled;
            }

            using var computerSearcher = new ManagementObjectSearcher(
                "SELECT HypervisorPresent FROM Win32_ComputerSystem");
            var computer = computerSearcher.Get().Cast<ManagementObject>().FirstOrDefault();
            if (computer?["HypervisorPresent"] is bool hypervisorPresent)
            {
                return hypervisorPresent ? SettingState.Enabled : SettingState.Disabled;
            }
        }
        catch
        {
            return SettingState.Unknown;
        }

        return SettingState.Unknown;
    }

    public static SettingState GetUacState()
    {
        using var key = Registry.LocalMachine.OpenSubKey(
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System");
        var value = key?.GetValue("EnableLUA");
        if (value is int intValue)
        {
            return intValue == 1 ? SettingState.Enabled : SettingState.Disabled;
        }

        return SettingState.Unknown;
    }

    private static SettingState GetDefenderRealTimeFromWmi()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                @"root\Microsoft\Windows\Defender",
                "SELECT RealTimeProtectionEnabled FROM MSFT_MpComputerStatus");
            var result = searcher.Get().Cast<ManagementObject>().FirstOrDefault();
            if (result?["RealTimeProtectionEnabled"] is bool enabled)
            {
                return enabled ? SettingState.Enabled : SettingState.Disabled;
            }
        }
        catch
        {
            return SettingState.Unknown;
        }

        return SettingState.Unknown;
    }
}
