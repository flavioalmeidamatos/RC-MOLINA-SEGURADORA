using Microsoft.Web.WebView2.Core;
using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace RCMolinaApp.Views
{
    public partial class MainWindow : Window
    {
        private readonly string _myWebAppUrl = "https://rcmolinaseguros.resolveplanilhas.com.br";
        private readonly string _userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RCMolinaApp");
        private const int OverlayToolbarHeight = 45;

        private Window? _overlayWindow;
        private Microsoft.Web.WebView2.Wpf.WebView2? _overlayWebView;
        private int _sidebarWidth = 192;
        private int _headerHeight = 64;
        private string? _pendingExecuteScript;
        private bool _isClosingOverlay;

        public MainWindow()
        {
            InitializeComponent();

            Loaded += MainWindow_Loaded;
            LocationChanged += MainWindow_LocationChanged;
            SizeChanged += MainWindow_SizeChanged;
            StateChanged += MainWindow_StateChanged;
            Closing += MainWindow_Closing;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            InitializeAsync();
        }

        private Microsoft.Web.WebView2.Wpf.CoreWebView2CreationProperties CreateWebViewCreationProperties()
        {
            return new Microsoft.Web.WebView2.Wpf.CoreWebView2CreationProperties
            {
                UserDataFolder = _userDataFolder
            };
        }

        private void CreateOverlayWindow()
        {
            _overlayWindow = new Window
            {
                WindowStyle = WindowStyle.None,
                AllowsTransparency = true,
                Background = System.Windows.Media.Brushes.White,
                ShowInTaskbar = false,
                Owner = this
            };

            var layout = new Grid();
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(OverlayToolbarHeight) });
            layout.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            var toolbar = new Grid
            {
                Background = new SolidColorBrush(Color.FromRgb(239, 246, 255))
            };
            toolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            toolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var instruction = new TextBlock
            {
                Text = "Pressione ESC para retornar ao menu principal",
                Foreground = new SolidColorBrush(Color.FromRgb(29, 78, 216)),
                FontSize = 12,
                FontWeight = FontWeights.Bold,
                TextAlignment = TextAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(instruction, 0);
            toolbar.Children.Add(instruction);

            var closeButton = new Button
            {
                Content = "X",
                Width = 36,
                Height = 30,
                Margin = new Thickness(0, 0, 12, 0),
                Padding = new Thickness(0),
                Foreground = new SolidColorBrush(Color.FromRgb(29, 78, 216)),
                Background = Brushes.Transparent,
                BorderBrush = Brushes.Transparent,
                FontWeight = FontWeights.Bold,
                VerticalAlignment = VerticalAlignment.Center,
                Cursor = System.Windows.Input.Cursors.Hand
            };
            closeButton.Click += (s, ev) => CloseExternalWindow();
            Grid.SetColumn(closeButton, 1);
            toolbar.Children.Add(closeButton);
            Grid.SetRow(toolbar, 0);
            layout.Children.Add(toolbar);

            _overlayWebView = new Microsoft.Web.WebView2.Wpf.WebView2
            {
                CreationProperties = CreateWebViewCreationProperties()
            };
            Grid.SetRow(_overlayWebView, 1);
            layout.Children.Add(_overlayWebView);

            _overlayWindow.Content = layout;

            _overlayWindow.PreviewKeyDown += (s, ev) =>
            {
                if (ev.Key == System.Windows.Input.Key.Escape)
                {
                    CloseExternalWindow();
                }
            };
        }

        private async void CloseExternalWindow()
        {
            if (_overlayWindow == null || _isClosingOverlay)
            {
                return;
            }

            _isClosingOverlay = true;
            var win = _overlayWindow;
            var wv = _overlayWebView;
            _overlayWindow = null;
            _overlayWebView = null;
            _pendingExecuteScript = null;
            NotifyExternalWindowClosed();

            try
            {
                win.Hide();

                if (wv != null)
                {
                    if (wv.CoreWebView2 != null)
                    {
                        try
                        {
                            wv.CoreWebView2.NavigationCompleted -= OverlayWebView_NavigationCompleted;
                            wv.CoreWebView2.NewWindowRequested -= OverlayWebView_NewWindowRequested;
                            wv.CoreWebView2.Stop();
                            wv.CoreWebView2.Navigate("about:blank");
                        }
                        catch { }
                    }

                    await System.Threading.Tasks.Task.Delay(100);
                    try
                    {
                        wv.Dispose();
                    }
                    catch { }
                }
            }
            catch { }
            finally
            {
                try
                {
                    win.Content = null;
                    win.Close();
                }
                catch { }

                _isClosingOverlay = false;
            }
        }

        private async void NotifyExternalWindowClosed()
        {
            try
            {
                if (AppWebView.CoreWebView2 != null)
                {
                    await AppWebView.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('rc-external-webview-closed'));");
                }
            }
            catch { }
        }

        private void MainWindow_LocationChanged(object? sender, EventArgs e) => UpdateOverlayPosition();
        private void MainWindow_SizeChanged(object sender, SizeChangedEventArgs e) => UpdateOverlayPosition();
        private void MainWindow_StateChanged(object? sender, EventArgs e) => UpdateOverlayPosition();

        private void UpdateOverlayPosition()
        {
            if (_overlayWindow == null) return;

            try
            {
                PresentationSource source = PresentationSource.FromVisual(this);
                if (source == null) return;

                double dpiX = source.CompositionTarget.TransformToDevice.M11;
                double dpiY = source.CompositionTarget.TransformToDevice.M22;

                int overlayTopOffset = Math.Max(0, _headerHeight - OverlayToolbarHeight);
                Point pt = AppWebView.PointToScreen(new Point(_sidebarWidth, overlayTopOffset));
                _overlayWindow.Left = pt.X / dpiX;
                _overlayWindow.Top = pt.Y / dpiY;
                _overlayWindow.Width = Math.Max(0, AppWebView.ActualWidth - _sidebarWidth);
                _overlayWindow.Height = Math.Max(0, AppWebView.ActualHeight - overlayTopOffset);
            }
            catch { }
        }

        private async void InitializeAsync()
        {
            try
            {
                AppWebView.CreationProperties ??= CreateWebViewCreationProperties();
                await AppWebView.EnsureCoreWebView2Async();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro ao inicializar o WebView2: {ex.Message}");
            }
        }

        private async System.Threading.Tasks.Task EnsureOverlayWebViewInitializedAsync()
        {
            if (_overlayWindow == null || _overlayWebView == null)
            {
                CreateOverlayWindow();
            }

            UpdateOverlayPosition();
            _overlayWindow?.Show();

            if (_overlayWebView?.CoreWebView2 == null)
            {
                await _overlayWebView!.EnsureCoreWebView2Async();
                _overlayWebView.CoreWebView2.NavigationCompleted += OverlayWebView_NavigationCompleted;
                _overlayWebView.CoreWebView2.NewWindowRequested += OverlayWebView_NewWindowRequested;
            }
        }

        private async void OverlayWebView_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (e.IsSuccess && !_isClosingOverlay && _overlayWebView != null && !string.IsNullOrEmpty(_pendingExecuteScript))
            {
                try
                {
                    await _overlayWebView.CoreWebView2.ExecuteScriptAsync(_pendingExecuteScript);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Erro ao executar script: {ex.Message}");
                }
            }
        }

        private void OverlayWebView_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs ev)
        {
            ev.Handled = true;
            _overlayWebView?.CoreWebView2.Navigate(ev.Uri);
        }

        private void AppWebView_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess) return;

            AppWebView.CoreWebView2.Settings.IsScriptEnabled = true;
            AppWebView.CoreWebView2.Settings.IsWebMessageEnabled = true;
            AppWebView.CoreWebView2.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.CacheStorage | CoreWebView2BrowsingDataKinds.DiskCache);

            AppWebView.CoreWebView2.NewWindowRequested += (s, ev) =>
            {
                ev.Handled = true;
                AppWebView.CoreWebView2.Navigate(ev.Uri);
            };

            AppWebView.CoreWebView2.WebMessageReceived += AppWebView_WebMessageReceived;

            AppWebView.PreviewKeyDown += (s, ev) =>
            {
                if (ev.Key == System.Windows.Input.Key.Escape)
                {
                    CloseExternalWindow();
                }
            };

            AppWebView.CoreWebView2.Navigate(_myWebAppUrl);
        }

        private async void AppWebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var messageJson = e.TryGetWebMessageAsString();
                var payload = JsonDocument.Parse(messageJson);
                var root = payload.RootElement;

                string action = root.GetProperty("action").GetString() ?? "";

                if (action == "open_external" && root.TryGetProperty("url", out var urlProp))
                {
                    string url = urlProp.GetString() ?? "about:blank";

                    if (root.TryGetProperty("sidebarWidth", out var sw))
                    {
                        _sidebarWidth = sw.GetInt32();
                    }

                    if (root.TryGetProperty("headerHeight", out var hh))
                    {
                        _headerHeight = hh.GetInt32();
                    }

                    _pendingExecuteScript = root.TryGetProperty("executeScript", out var es)
                        ? es.GetString()
                        : null;

                    await EnsureOverlayWebViewInitializedAsync();
                    _overlayWebView?.CoreWebView2?.Navigate(url);
                }
                else if (action == "close_external")
                {
                    CloseExternalWindow();
                }
                else if (action == "close_app")
                {
                    Close();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro interno do C#: {ex.Message}\nStack: {ex.StackTrace}", "Erro no App", MessageBoxButton.OK, MessageBoxImage.Error);
                System.Diagnostics.Debug.WriteLine($"Erro ao processar mensagem do WebView: {ex.Message}");
            }
        }
        private bool _isClosingApp = false;

        private async void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            if (!_isClosingApp)
            {
                e.Cancel = true;
                _isClosingApp = true;
                await CleanupAndExitAsync();
            }
        }

        private async System.Threading.Tasks.Task CleanupAndExitAsync()
        {
            try
            {
                if (AppWebView?.CoreWebView2?.Profile != null)
                {
                    await AppWebView.CoreWebView2.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.AllProfile);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao limpar dados de navegação: {ex.Message}");
            }

            try
            {
                var processes = System.Diagnostics.Process.GetProcessesByName("node");
                foreach (var process in processes)
                {
                    try
                    {
                        process.Kill();
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"Erro ao encerrar processo node: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao buscar processos node: {ex.Message}");
            }

            Application.Current.Shutdown();
        }
    }
}
