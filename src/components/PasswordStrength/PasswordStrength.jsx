import { useMemo } from "react";
import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { evaluatePassword } from "@/utils/passwordPolicy";
import "./PasswordStrength.css";

const RULE_ICONS = { valid: FiCheck, pending: FiMinus, failed: FiX };
const RULE_ICON_SIZE = 14;

function PasswordStrength({ password, confirmPassword }) {
  // Memoised because scoring walks the string several times and this renders on every keystroke of two
  // fields at once.
  const { meter, rules } = useMemo(() => evaluatePassword(password, confirmPassword), [password, confirmPassword]);
  const segments = Array.from({ length: meter.max }, (_, index) => index + 1);

  return (
    <>
      <div className={`pw-strength ${meter.variant}`}>
        <div className="pw-strength-segments" aria-hidden="true">
          {segments.map((segment) => (
            <span key={segment} className={segment <= meter.score ? "on" : ""} />
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
