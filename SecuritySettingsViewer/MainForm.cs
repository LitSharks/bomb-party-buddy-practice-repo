using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace SecuritySettingsViewer;

public sealed class MainForm : Form
{
    private readonly TableLayoutPanel _layout;
    private readonly List<SettingRow> _rows = new();

    public MainForm()
    {
        Text = "Security Settings Status";
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(720, 520);
        MinimumSize = new Size(640, 480);
        BackColor = ThemeColors.Background;
        ForeColor = ThemeColors.TextPrimary;

        var header = new Label
        {
            Text = "Security Settings Overview",
            Dock = DockStyle.Top,
            Height = 52,
            Font = new Font(FontFamily.GenericSansSerif, 18, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(20, 10, 0, 0),
            ForeColor = ThemeColors.TextPrimary,
            BackColor = ThemeColors.Header
        };

        _layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            AutoScroll = true,
            Padding = new Padding(20, 20, 20, 20),
            BackColor = ThemeColors.Background
        };

        Controls.Add(_layout);
        Controls.Add(header);

        BuildRows();
        Load += (_, _) => RefreshStatuses();
    }

    private void BuildRows()
    {
        _rows.AddRange(new[]
        {
            new SettingRow("🛡️", "Real Time Security", SecurityChecker.GetRealTimeProtectionState),
            new SettingRow("📦", "Driver Blocklist", SecurityChecker.GetDriverBlocklistState),
            new SettingRow("🔐", "Secure Boot", SecurityChecker.GetSecureBootState),
            new SettingRow("🧩", "Virtualization / Hyper-V", SecurityChecker.GetHyperVState),
            new SettingRow("👤", "User Account Control (UAC)", SecurityChecker.GetUacState)
        });

        foreach (var row in _rows)
        {
            _layout.Controls.Add(row.Panel);
        }
    }

    private void RefreshStatuses()
    {
        foreach (var row in _rows)
        {
            var state = row.Checker();
            row.UpdateState(state);
        }
    }

    private static class ThemeColors
    {
        public static readonly Color Background = Color.FromArgb(11, 20, 60);
        public static readonly Color Header = Color.FromArgb(9, 15, 48);
        public static readonly Color Card = Color.FromArgb(16, 28, 78);
        public static readonly Color TextPrimary = Color.White;
        public static readonly Color TextSecondary = Color.FromArgb(200, 210, 240);
        public static readonly Color Enabled = Color.FromArgb(220, 60, 60);
        public static readonly Color Disabled = Color.FromArgb(40, 180, 110);
        public static readonly Color Unknown = Color.FromArgb(140, 150, 170);
    }

    private sealed class SettingRow
    {
        public Panel Panel { get; }
        public Func<SettingState> Checker { get; }

        private readonly Label _statusText;
        private readonly PictureBox _statusIcon;

        public SettingRow(string icon, string title, Func<SettingState> checker)
        {
            Checker = checker;

            Panel = new Panel
            {
                Height = 72,
                Dock = DockStyle.Top,
                BackColor = ThemeColors.Card,
                Padding = new Padding(16, 10, 16, 10),
                Margin = new Padding(0, 0, 0, 12)
            };

            var iconLabel = new Label
            {
                Text = icon,
                Font = new Font(FontFamily.GenericSansSerif, 20, FontStyle.Regular),
                AutoSize = true,
                ForeColor = ThemeColors.TextPrimary,
                Location = new Point(10, 16)
            };

            var titleLabel = new Label
            {
                Text = title,
                Font = new Font(FontFamily.GenericSansSerif, 12, FontStyle.Bold),
                AutoSize = true,
                ForeColor = ThemeColors.TextPrimary,
                Location = new Point(56, 12)
            };

            _statusText = new Label
            {
                Text = "Checking...",
                Font = new Font(FontFamily.GenericSansSerif, 10, FontStyle.Regular),
                AutoSize = true,
                ForeColor = ThemeColors.TextSecondary,
                Location = new Point(56, 36)
            };

            _statusIcon = new PictureBox
            {
                Size = new Size(26, 26),
                Location = new Point(Panel.Width - 50, 20),
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };

            Panel.Controls.Add(iconLabel);
            Panel.Controls.Add(titleLabel);
            Panel.Controls.Add(_statusText);
            Panel.Controls.Add(_statusIcon);
        }

        public void UpdateState(SettingState state)
        {
            var (text, color) = state switch
            {
                SettingState.Enabled => ("Enabled (On)", ThemeColors.Enabled),
                SettingState.Disabled => ("Disabled (Off)", ThemeColors.Disabled),
                _ => ("Unknown", ThemeColors.Unknown)
            };

            _statusText.Text = $"Status: {text}";
            _statusIcon.Image?.Dispose();
            _statusIcon.Image = CreateStatusIcon(color);
        }

        private static Bitmap CreateStatusIcon(Color color)
        {
            var bitmap = new Bitmap(26, 26);
            using var graphics = Graphics.FromImage(bitmap);
            graphics.Clear(Color.Transparent);
            using var brush = new SolidBrush(color);
            graphics.FillEllipse(brush, 2, 2, 22, 22);
            return bitmap;
        }
    }
}
