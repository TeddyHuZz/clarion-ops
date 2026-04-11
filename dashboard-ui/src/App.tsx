import { Show, SignInButton, SignUpButton } from "@clerk/react";
import { Toaster } from "sonner";
import { Dashboard } from "./components/Dashboard";
import "./App.css";

function LandingPage() {
  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <div className="landing-logo">CLARION <span>OPS</span></div>
        <div className="landing-nav__actions">
          <SignInButton mode="modal">
            <button className="btn-nav-signin">Sign In</button>
          </SignInButton>
        </div>
      </nav>

      <section className="landing-hero">
        <img 
          src="/hero.png" 
          alt="Intelligence Ops Infrastructure" 
          className="landing-hero__bg" 
        />
        <div className="landing-hero__overlay" />
        
        <div className="landing-hero__content">
          <div className="landing-badge">Industry Standard DevSecOps</div>
          <h1 className="landing-title">
            Modern Command Center for Intelligent Ops.
          </h1>
          <p className="landing-subtitle">
            Deploy with confidence. Monitor with precision. Secure your 
            infrastructure with elite, data-driven intelligence tools designed for the modern stack.
          </p>
          <div className="landing-actions">
            <SignUpButton mode="modal">
              <button className="btn-primary">Get Started Free</button>
            </SignUpButton>
            <button className="btn-secondary">View Documentation</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function App() {
  return (
    <>
      <Toaster position="top-right" richColors theme="dark" />

      <Show when="signed-in">
        <div className="dashboard-view">
          <Dashboard />
        </div>
      </Show>

      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

export default App;
