import { Component } from "react";
import PropTypes from "prop-types";
import "./ErrorBoundary.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: "", copied: false };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleGoHome = this.handleGoHome.bind(this);
    this.handleCopyDetails = this.handleCopyDetails.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    window.addEventListener("hashchange", this.handleHashChange);
  }

  componentWillUnmount() {
    window.removeEventListener("hashchange", this.handleHashChange);
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack ?? "" });
  }

  handleHashChange() {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null, componentStack: "", copied: false });
    }
  }

  handleRetry() {
    this.setState({ hasError: false, error: null, componentStack: "", copied: false });
  }

  handleGoHome() {
    window.location.hash = "#/";
    this.setState({ hasError: false, error: null, componentStack: "", copied: false });
  }

  buildDetails() {
    const { error, componentStack } = this.state;
    const message = error?.stack || error?.message || String(error ?? "");
    return `${message}\n\nComponent stack:${componentStack}`.trim();
  }

  handleCopyDetails() {
    const details = this.buildDetails();
    const done = () => this.setState({ copied: true });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(details).then(done).catch(done);
    } else {
      done();
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const details = this.buildDetails();

    return (
      <div className="error-boundary">
        <h2 className="error-boundary-title">Beklenmeyen bir hata oluştu</h2>
        <p className="error-boundary-text">Bu sayfa görüntülenirken bir sorun çıktı.</p>
        <div className="error-boundary-actions">
          <button onClick={this.handleRetry}>Yeniden Dene</button>
          <button className="error-boundary-secondary" onClick={this.handleGoHome}>
            Ana Sayfaya Dön
          </button>
        </div>
        {details && (
          <details className="error-boundary-details">
            <summary>Teknik detay</summary>
            <pre className="error-boundary-stack">{details}</pre>
            <button className="error-boundary-secondary" onClick={this.handleCopyDetails}>
              {this.state.copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </details>
        )}
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
