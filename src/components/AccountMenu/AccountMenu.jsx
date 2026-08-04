import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiLogOut, FiRepeat, FiUser } from "react-icons/fi";
import { useCurrentUser, clearCurrentUser } from "@/hooks/useCurrentUser";
import { showAlert } from "@/utils/alert";
import "./AccountMenu.css";

function AccountMenu() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    const confirmed = await showAlert.confirm("Çıkış Yap", "Oturumu kapatmak istiyor musunuz?", "Vazgeç", "Evet, Çık");
    if (!confirmed) return;
    clearCurrentUser();
    navigate("/", { replace: true });
  };

  const closeMenuAndNavigate = (path, state) => {
    setIsOpen(false);
    navigate(path, state);
  };

  const label = user?.managerName || user?.username || "Hesabım";

  return (
    <div className="account-menu" ref={wrapperRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="account-menu-avatar">
          <FiUser size={16} />
        </span>
        <span className="account-menu-label">{label}</span>
        <FiChevronDown className={`account-menu-caret${isOpen ? " account-menu-caret--open" : ""}`} size={16} />
      </button>

      {isOpen && (
        <div className="account-menu-panel" role="menu">
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => closeMenuAndNavigate("/profile")}
          >
            <FiUser size={17} />
            <span>Profilim</span>
          </button>
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => closeMenuAndNavigate("/select-building", { state: { manual: true } })}
          >
            <FiRepeat size={17} />
            <span>Bina Değiştir</span>
          </button>
          <div className="account-menu-divider" />
          <button
            type="button"
            className="account-menu-item account-menu-item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <FiLogOut size={17} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
