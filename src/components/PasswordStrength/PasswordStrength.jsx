import { useMemo } from "react";
import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { evaluatePassword, STRENGTH_LEVELS } from "@/utils/passwordPolicy";
import "./PasswordStrength.css";

const RULE_ICONS = { valid: FiCheck, pending: FiMinus, failed: FiX };
const RULE_ICON_SIZE = 14;

function PasswordStrength({ password, confirmPassword }) {
  // Memoised because scoring walks the string several times and this renders on every keystroke of two
  // fields at once.
  const { meter, rules } = useMemo(() => evaluatePassword(password, confirmPassword), [password, confirmPassword]);

  return (
    <>
      <div className={`pw-strength ${meter.variant}`}>
        <div className="pw-strength-segments" aria-hidden="true">
          {STRENGTH_LEVELS.map((level, index) => (
            <span key={level.variant} className={index < meter.score ? level.variant : ""} />
          ))}
        </div>
        <span className="pw-strength-label">{meter.label}</span>
      </div>

      <ul className="pw-rules">
        {rules.map((rule) => {
          const state = rule.isMet ? "valid" : rule.isPending ? "pending" : "failed";
          const RuleIcon = RULE_ICONS[state];
          return (
            <li key={rule.id} className={`pw-rule-${state}`}>
              <RuleIcon className="pw-rule-icon" size={RULE_ICON_SIZE} />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default PasswordStrength;
