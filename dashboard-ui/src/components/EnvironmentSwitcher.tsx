import { useState } from "react";
import { Globe, ChevronDown, Server } from "lucide-react";
import "./EnvironmentSwitcher.css";
import { useEnvironment } from "../contexts/EnvironmentContext";
import type { Environment } from "../contexts/EnvironmentContext";

interface EnvironmentConfig {
  key: Environment;
  label: string;
  color: string;
  dotColor: string;
}

const ENVIRONMENTS: EnvironmentConfig[] = [
  { 
    key: "dev", 
    label: "Development", 
    color: "env-switcher--dev", 
    dotColor: "#22d3ee" 
  },
  { 
    key: "staging", 
    label: "Staging", 
    color: "env-switcher--staging", 
    dotColor: "#fbbf24" 
  },
  { 
    key: "prod", 
    label: "Production", 
    color: "env-switcher--production", 
    dotColor: "#f87171" 
  },
];

export function EnvironmentSwitcher() {
  const { currentEnv, setEnv } = useEnvironment();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (env: Environment) => {
    setEnv(env);
    setIsOpen(false);
  };

  const activeConfig = ENVIRONMENTS.find(e => e.key === currentEnv)!;

  return (
    <div className="env-switcher">
      <button
        className={`env-switcher__trigger ${activeConfig.color}`}
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Switch environment. Currently: ${activeConfig.label}`}
      >
        <Globe size={14} />
        <span className="env-switcher__label">{activeConfig.label}</span>
        <ChevronDown size={14} className={`env-switcher__chevron ${isOpen ? "env-switcher__chevron--open" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="env-switcher__backdrop" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="env-switcher__dropdown" role="listbox" aria-label="Environment options">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env.key}
                role="option"
                aria-selected={env.key === currentEnv}
                className={`env-switcher__option ${env.color} ${env.key === currentEnv ? "env-switcher__option--active" : ""}`}
                onClick={() => handleSelect(env.key)}
              >
                <Server size={14} />
                <span>{env.label}</span>
                {env.key === currentEnv && <span className="env-switcher__checkmark">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
