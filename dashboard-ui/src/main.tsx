import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import "./index.css";
import App from "./App.tsx";
import { EnvironmentProvider } from "./contexts/EnvironmentContext";

// Import your publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY} 
      afterSignOutUrl="/"
      appearance={{
        layout: {
          socialButtonsPlacement: "top",
          shimmer: true,
        },
        variables: {
          colorPrimary: "#c9ada7",
          colorText: "#f2e9e4",
          colorTextSecondary: "#9a8c98",
          colorBackground: "#22223b",
          colorInputBackground: "#4a4e69",
          colorInputText: "#f2e9e4",
          borderRadius: "0.875rem",
        },
        elements: {
          card: {
            backgroundColor: "#22223b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          },
          headerTitle: {
            fontFamily: "Outfit, sans-serif",
            letterSpacing: "-0.02em",
          },
          socialButtonsBlockButton: {
            backgroundColor: "rgba(74, 78, 105, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            transition: "all 0.3s ease",
            "&:hover": {
              backgroundColor: "rgba(74, 78, 105, 0.6)",
              borderColor: "#c9ada7",
            }
          },
          formButtonPrimary: {
            backgroundColor: "#c9ada7",
            color: "#22223b",
            fontWeight: "600",
            textTransform: "none",
            "&:hover": {
              backgroundColor: "#d6bcba",
            }
          },
          formFieldInput: {
            backgroundColor: "rgba(74, 78, 105, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#f2e9e4",
          },
          footerActionLink: {
            color: "#c9ada7",
            fontWeight: "600",
            "&:hover": {
              color: "#d6bcba",
            }
          },
          identityPreviewText: {
            color: "#f2e9e4",
          },
          identityPreviewEditButtonIcon: {
            color: "#c9ada7",
          }
        }
      }}
    >
      <EnvironmentProvider>
        <App />
      </EnvironmentProvider>
    </ClerkProvider>
  </StrictMode>,
);
