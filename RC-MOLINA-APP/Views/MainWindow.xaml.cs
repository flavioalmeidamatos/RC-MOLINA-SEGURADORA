using Microsoft.Web.WebView2.Core;
using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Linq;

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
                string message = e.TryGetWebMessageAsString();
                if (AppWebView?.CoreWebView2 != null) AppWebView.CoreWebView2.ExecuteScriptAsync($"alert('C# Recebeu: {message.Replace("'", "\\'")}');");
                
                var payload = JsonDocument.Parse(message);
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
                else if (action == "list_scanners")
                {
                    ListScanners();
                }
                else if (action == "scan_document")
                {
                    bool useIp = root.TryGetProperty("useIp", out var useIpProp) && useIpProp.GetBoolean();
                    string scannerId = root.TryGetProperty("scannerId", out var scannerIdProp) ? scannerIdProp.GetString() ?? "" : "";
                    ScanDocument(useIp, scannerId);
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

        private async System.Threading.Tasks.Task<System.Collections.Generic.List<string>> DiscoverNetworkScannersFastAsync()
        {
            var scanners = new System.Collections.Generic.List<string>();
            try
            {
                var localIps = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()
                    .Where(n => n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up)
                    .SelectMany(n => n.GetIPProperties().UnicastAddresses)
                    .Where(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                    .Select(a => a.Address.ToString())
                    .ToList();

                var tasks = new System.Collections.Generic.List<System.Threading.Tasks.Task>();
                var httpClient = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
                var semaphore = new System.Threading.SemaphoreSlim(20);

                foreach (var ip in localIps)
                {
                    if (ip == "127.0.0.1") continue;
                    var lastDot = ip.LastIndexOf('.');
                    if (lastDot < 0) continue;
                    var subnet = ip.Substring(0, lastDot + 1);

                    for (int i = 1; i <= 254; i++)
                    {
                        var targetIp = subnet + i;
                        tasks.Add(System.Threading.Tasks.Task.Run(async () =>
                        {
                            await semaphore.WaitAsync();
                            try
                            {
                                var response = await httpClient.GetAsync($"http://{targetIp}/eSCL/ScannerCapabilities");
                                if (response.IsSuccessStatusCode)
                                {
                                    var content = await response.Content.ReadAsStringAsync();
                                    string model = "Scanner Rede (eSCL)";
                                    int start = content.IndexOf("<pwg:MakeAndModel>");
                                    if (start > 0)
                                    {
                                        start += 18;
                                        int end = content.IndexOf("</pwg:MakeAndModel>", start);
                                        if (end > start)
                                            model = content.Substring(start, end - start);
                                    }
                                    lock (scanners)
                                    {
                                        scanners.Add($"{model} [REDE] ({targetIp})");
                                    }
                                }
                            }
                            catch { }
                            finally
                            {
                                semaphore.Release();
                            }
                        }));
                    }
                }
                await System.Threading.Tasks.Task.WhenAll(tasks);
            }
            catch { }
            return scanners;
        }

        private async void ListScanners()
        {
            try
            {
                var scanners = new System.Collections.Generic.List<string>();

                // 1. Buscar WIA (Local/USB ou Instalados na Rede)
                try
                {
                    Type? t = Type.GetTypeFromProgID("WIA.DeviceManager");
                    if (t != null)
                    {
                        dynamic deviceManager = Activator.CreateInstance(t)!;
                        foreach (dynamic info in deviceManager.DeviceInfos)
                        {
                            try 
                            {
                                string name = "Scanner WIA";
                                try { name = info.Properties.Item("Name").Value.ToString(); } catch { }
                                
                                string id = info.DeviceID;
                                string type = info.Type.ToString();
                                scanners.Add($"{name} [Tipo {type}] ({id})");
                            }
                            catch (Exception innerEx) 
                            { 
                                scanners.Add($"Erro ao ler scanner: {innerEx.Message}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Aviso WIA: {ex.Message}");
                    scanners.Add($"ERRO WIA: {ex.Message}");
                }

                // Enviar scanners WIA imediatamente para a UI
                var payload = new { action = "scanner_list_result", scanners = scanners, success = true };
                if (AppWebView.CoreWebView2 != null)
                {
                    AppWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
                }

                // 2. Buscar eSCL (Rede Wi-Fi / Ethernet) no fundo
                var networkScanners = await DiscoverNetworkScannersFastAsync();
                if (networkScanners.Count > 0)
                {
                    scanners.AddRange(networkScanners);
                    var payload2 = new { action = "scanner_list_result", scanners = scanners, success = true };
                    if (AppWebView.CoreWebView2 != null)
                    {
                        AppWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload2));
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao listar scanners: {ex.Message}");
                var payload = new { action = "scanner_list_result", scanners = new System.Collections.Generic.List<string>(), error = ex.Message };
                if (AppWebView.CoreWebView2 != null)
                {
                    AppWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
                }
            }
        }

        private async System.Threading.Tasks.Task<string?> ScanEsclAsync(string ip)
        {
            var httpClient = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            string xml = @"<?xml version=""1.0"" encoding=""UTF-8""?>
<scan:ScanSettings xmlns:pwg=""http://www.pwg.org/schemas/2010/12/sm"" xmlns:scan=""http://schemas.hp.com/imaging/escl/2011/05/empty/v1.0"">
  <pwg:Version>2.0</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:XOffset>0</pwg:XOffset>
      <pwg:YOffset>0</pwg:YOffset>
      <pwg:Width>2550</pwg:Width>
      <pwg:Height>3300</pwg:Height>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
  <scan:DocumentFormat>image/jpeg</scan:DocumentFormat>
  <scan:ColorMode>RGB24</scan:ColorMode>
  <scan:XResolution>300</scan:XResolution>
  <scan:YResolution>300</scan:YResolution>
</scan:ScanSettings>";

            var content = new System.Net.Http.StringContent(xml, System.Text.Encoding.UTF8, "text/xml");
            var response = await httpClient.PostAsync($"http://{ip}/eSCL/ScanJobs", content);
            if (!response.IsSuccessStatusCode)
                throw new Exception($"Scanner na rede rejeitou o pedido (eSCL). Código: {response.StatusCode}");

            string location = response.Headers.Location?.ToString() ?? "";
            if (string.IsNullOrEmpty(location))
                throw new Exception("Scanner não retornou o local da imagem.");
            if (!location.StartsWith("http")) location = $"http://{ip}{location}";

            // Dá um tempo pro scanner puxar o papel/scanear
            await System.Threading.Tasks.Task.Delay(3000);

            var imageResponse = await httpClient.GetAsync($"{location}/NextDocument");
            if (imageResponse.IsSuccessStatusCode)
            {
                var bytes = await imageResponse.Content.ReadAsByteArrayAsync();
                return "data:image/jpeg;base64," + Convert.ToBase64String(bytes);
            }
            throw new Exception("Scanner falhou em retornar os dados da imagem.");
        }

        private async void ScanDocument(bool useIp, string scannerId)
        {
            try
            {
                string? base64Image = null;

                bool isNetwork = useIp || scannerId.Contains("[REDE]");

                if (isNetwork)
                {
                    string targetIp = scannerId;
                    if (!useIp)
                    {
                        int start = scannerId.LastIndexOf('(');
                        int end = scannerId.LastIndexOf(')');
                        if (start >= 0 && end > start)
                            targetIp = scannerId.Substring(start + 1, end - start - 1);
                    }
                    
                    base64Image = await ScanEsclAsync(targetIp);
                }
                else
                {
                    string deviceId = scannerId;
                    int start = scannerId.LastIndexOf('(');
                    int end = scannerId.LastIndexOf(')');
                    if (start >= 0 && end > start)
                    {
                        deviceId = scannerId.Substring(start + 1, end - start - 1);
                    }

                    Type? t = Type.GetTypeFromProgID("WIA.DeviceManager");
                    if (t == null) throw new Exception("WIA não está instalado.");
                    dynamic deviceManager = Activator.CreateInstance(t)!;
                    
                    dynamic? selectedDevice = null;
                    foreach (dynamic info in deviceManager.DeviceInfos)
                    {
                        if (info.DeviceID == deviceId)
                        {
                            selectedDevice = info;
                            break;
                        }
                    }

                    if (selectedDevice == null)
                        throw new Exception("Scanner USB/WIA não encontrado.");

                    dynamic device = selectedDevice.Connect();
                    dynamic item = device.Items[1];
                    Type? tDialog = Type.GetTypeFromProgID("WIA.CommonDialog");
                    dynamic dialog = Activator.CreateInstance(tDialog!)!;
                    
                    dynamic imageFile = dialog.ShowTransfer(item, "{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}", true);
                    
                    if (imageFile != null)
                    {
                        var imageBytes = (byte[])imageFile.FileData.BinaryData;
                        string ext = "";
                        try { ext = imageFile.FileExtension.ToString().ToLower(); } catch { }
                        
                        string mimeType = "image/png";
                        if (ext == "bmp") mimeType = "image/bmp";
                        else if (ext == "jpg" || ext == "jpeg") mimeType = "image/jpeg";
                        else if (ext == "gif") mimeType = "image/gif";
                        else if (ext == "tif" || ext == "tiff") mimeType = "image/tiff";
                        
                        base64Image = $"data:{mimeType};base64," + Convert.ToBase64String(imageBytes);
                    }
                }

                if (!string.IsNullOrEmpty(base64Image))
                {
                    var payload = new { action = "scanner_scan_result", success = true, image = base64Image };
                    if (AppWebView.CoreWebView2 != null)
                    {
                        AppWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao escanear: {ex.Message}");
                var payload = new { action = "scanner_scan_result", success = false, error = ex.Message };
                if (AppWebView.CoreWebView2 != null)
                {
                    AppWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
                }
            }
        }
    }
}


