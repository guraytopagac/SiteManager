import { Component } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import "./ErrorBoundary.css";

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleGoHome = () => {
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <FiAlertTriangle className="error-boundary-icon" size={44} aria-hidden="true" />
        <h2 className="error-boundary-title">Bu sayfa açılamadı</h2>
        <p className="error-boundary-text">Kayıtlarınız güvende. Ana sayfaya dönüp tekrar deneyin.</p>
        <button onClick={this.handleGoHome}>Ana Sayfaya Dön</button>
      </div>
    );
  }
}

export default ErrorBoundary;
