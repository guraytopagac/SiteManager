import { FiCheck, FiMinus, FiX } from "react-icons/fi";
import { buildPasswordRules, buildStrengthMeter, scorePassword } from "@/utils/passwordStrength";
import "./PasswordStrength.css";

const RULE_ICONS = { valid: FiCheck, pending: FiMinus, failed: FiX };
const SEGMENTS = [1, 2, 3, 4, 5];
const RULE_ICON_SIZE = 14;

function PasswordStrength({ password, confirmPassword }) {
  const strength = scorePassword(password);
  const meter = buildStrengthMeter(password, strength);
  const rules = buildPasswordRules({ password, confirmPassword, strength });

  return (
    <>
      <div className={`pw-strength ${meter.variant}`}>
        <div className="pw-strength-segments" aria-hidden="true">
          {SEGMENTS.map((segment) => (
            <span key={segment} className={segment <= strength.score ? "on" : ""} />
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
