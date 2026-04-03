import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Environment = "Development" | "Staging" | "Production";

interface EnvSwitcherProps {
  onEnvChange?: (env: Environment) => void;
}

export function EnvSwitcher({ onEnvChange }: EnvSwitcherProps) {
  const [currentEnv, setCurrentEnv] = useState<Environment>("Development");

  const environments: Environment[] = ["Development", "Staging", "Production"];

  const handleEnvChange = (env: Environment) => {
    setCurrentEnv(env);
    onEnvChange?.(env);
  };

  const getEnvColor = (env: Environment): string => {
    switch (env) {
      case "Development":
        return "text-blue-400";
      case "Staging":
        return "text-yellow-400";
      case "Production":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 border border-secondary/60 rounded-lg hover:bg-secondary/20 transition-colors">
        <span className={`font-semibold ${getEnvColor(currentEnv)}`}>
          {currentEnv}
        </span>
        <ChevronDown size={16} className="opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {environments.map((env) => (
          <DropdownMenuItem
            key={env}
            onClick={() => handleEnvChange(env)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span>{env}</span>
            {currentEnv === env && <Check size={16} className="text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
