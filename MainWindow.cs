using System.Windows;
using RobApp.UI.ViewModels;

namespace RobApp.UI
{
	public partial class MainWindow : Window
	{
		public MainWindow()
		{
			InitializeComponent();
			DataContext = new MainViewModel();
		}
	}
}