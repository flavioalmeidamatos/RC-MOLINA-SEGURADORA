using Microsoft.Web.WebView2.Core;
using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;

namespace RCMolinaApp.Views
{
    public partial class MainWindow : Window
    {
        // ⚠️ ALERTA: Altere aqui para a URL raiz da sua Aplicação Web Real ⚠️
        private readonly string _myWebAppUrl = "https://rcmolinaseguros.resolveplanilhas.com.br"; 
        
        private Window? _overlayWindow;
        private Microsoft.Web.WebView2.Wpf.WebView2? _overlayWebView;
        private int _sidebarWidth = 192;
        private int _headerHeight = 64;
        private string? _pendingExecuteScript;

        public MainWindow()
        {
            InitializeComponent();
            
            this.Loaded += MainWindow_Loaded;
            
            this.LocationChanged += MainWindow_LocationChanged;
            this.SizeChanged += MainWindow_SizeChanged;
            this.StateChanged += MainWindow_StateChanged;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Pré-inicializa o overlay após a MainWindow já estar criada na tela
            CreateOverlayWindow();
            InitializeAsync();
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
            
            _overlayWebView = new Microsoft.Web.WebView2.Wpf.WebView2();
            _overlayWindow.Content = _overlayWebView;

            _overlayWindow.PreviewKeyDown += (s, ev) => 
            {
                if (ev.Key == System.Windows.Input.Key.Escape)
                {
                    CloseExternalWindow();
                }
            };
        }

        private void CloseExternalWindow()
        {
            if (_overlayWindow != null)
            {
                _overlayWindow.Hide();
                if (_overlayWebView?.CoreWebView2 != null)
                {
                    _overlayWebView.CoreWebView2.Navigate("about:blank");
                }
            }
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

                Point pt = AppWebView.PointToScreen(new Point(_sidebarWidth, _headerHeight));
                _overlayWindow.Left = pt.X / dpiX;
                _overlayWindow.Top = pt.Y / dpiY;
                _overlayWindow.Width = Math.Max(0, AppWebView.ActualWidth - _sidebarWidth);
                _overlayWindow.Height = Math.Max(0, AppWebView.ActualHeight - _headerHeight);
            }
            catch { }
        }

        private async void InitializeAsync()
        {
            try
            {
                var userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RCMolinaApp");
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                
                await AppWebView.EnsureCoreWebView2Async(env);
                if (_overlayWebView != null) 
                {
                    await _overlayWebView.EnsureCoreWebView2Async(env);
                    _overlayWebView.CoreWebView2.NavigationCompleted += OverlayWebView_NavigationCompleted;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Erro ao inicializar o WebView2: {ex.Message}");
            }
        }

        private async void OverlayWebView_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (e.IsSuccess && !string.IsNullOrEmpty(_pendingExecuteScript))
            {
                try
                {
                    await _overlayWebView!.CoreWebView2.ExecuteScriptAsync(_pendingExecuteScript);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Erro ao executar script: {ex.Message}");
                }
            }
        }

        private void AppWebView_CoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess) return;

            AppWebView.CoreWebView2.Settings.IsScriptEnabled = true;
            AppWebView.CoreWebView2.Settings.IsWebMessageEnabled = true;

            // Inscreve no evento que vai escutar as postMessages vindas do Javascript
            AppWebView.CoreWebView2.WebMessageReceived += AppWebView_WebMessageReceived;
            
            // Adiciona PreviewKeyDown no próprio AppWebView para pegar o ESC
            AppWebView.PreviewKeyDown += (s, ev) => 
            {
                if (ev.Key == System.Windows.Input.Key.Escape)
                {
                    CloseExternalWindow();
                }
            };

            // Carrega a sua aplicação Web inicial
            AppWebView.CoreWebView2.Navigate(_myWebAppUrl);
        }

        private void AppWebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
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

                    if (root.TryGetProperty("executeScript", out var es))
                    {
                        _pendingExecuteScript = es.GetString();
                    }
                    else
                    {
                        _pendingExecuteScript = null;
                    }

                    if (_overlayWebView?.CoreWebView2 != null)
                    {
                        _overlayWebView.CoreWebView2.Navigate(url);
                    }
                    else if (_overlayWebView != null)
                    {
                        _overlayWebView.Source = new Uri(url);
                    }
                    
                    UpdateOverlayPosition();
                    _overlayWindow?.Show();
                }
                else if (action == "close_external")
                {
                    CloseExternalWindow();
                }
                else if (action == "close_app")
                {
                    Application.Current.Shutdown();
                }
            }
            catch (Exception ex)
            {
                // Mostra o erro na tela para podermos debugar
                MessageBox.Show($"Erro interno do C#: {ex.Message}\nStack: {ex.StackTrace}", "Erro no App", MessageBoxButton.OK, MessageBoxImage.Error);
                System.Diagnostics.Debug.WriteLine($"Erro ao processar mensagem do WebView: {ex.Message}");
            }
        }
    }
}

