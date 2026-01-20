# Security Settings Viewer

This is a Windows Forms application that reports a handful of Windows security settings in a dark-blue UI.

## Features
- Real-time protection status
- Driver blocklist status
- Secure Boot status
- Virtualization / Hyper-V status
- UAC status

## Build and run
```sh
dotnet build
dotnet run
```

You can also open `SecuritySettingsViewer.sln` in Visual Studio to build and run the app.

> Note: The checks rely on Windows-specific APIs (WMI and registry), so run the application on Windows.
