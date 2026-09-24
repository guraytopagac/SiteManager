// The account tool of every protected screen. It takes no props and reads the session itself.
// No ARIA menu role: that would promise arrow key navigation and a roving tabindex, neither of them written.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiLogOut, FiRepeat, FiUser } from "react-icons/fi";
import { useSession, clearSession } from "@/hooks/useSession";
import { showDialog } from "@/components/Dialog/dialogStore";
import "./AccountMenu.css";

function MenuItem({ icon: Icon, label, danger, onClick }) {
  return (
    <button
      type="button"
      className={`account-menu-item${danger ? " account-menu-item--danger" : ""}`}
      onClick={onClick}
    >
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}

function AccountMenu() {
  const navigate = useNavigate();
  // No fallback chain: the column is NOT NULL and this renders only under the authenticated guard.
  const { managerName } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setIsOpen(false);
      // Focus goes back to the trigger, otherwise it would fall to the body and the next tab press would
      // restart from the top of the page.
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    const confirmed = await showDialog.confirmDanger(
      "Çıkış Yap",
      "Oturumu kapatmak istiyor musunuz?",
      "Vazgeç",
      "Evet, Çık",
    );
    if (!confirmed) return;
    clearSession();
    navigate("/", { replace: true });
  };

  const closeMenuAndNavigate = (path, options) => {
    setIsOpen(false);
    navigate(path, options);
  };

  return (
    <div className="account-menu" ref={wrapperRef}>
      <button
        type="button"
        className="account-menu-trigger"
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="account-menu-avatar">
          <FiUser size={16} />
        </span>
        <span className="account-menu-label" title={managerName}>
          {managerName}
        </span>
        <FiChevronDown className={`account-menu-caret${isOpen ? " account-menu-caret--open" : ""}`} size={16} />
      </button>

      {isOpen && (
        <div className="account-menu-panel">
          <MenuItem icon={FiUser} label="Profilim" onClick={() => closeMenuAndNavigate("/profile")} />
          <MenuItem
            icon={FiRepeat}
            label="Bina Değiştir"
            onClick={() => closeMenuAndNavigate("/select-building", { state: { manual: true } })}
          />
          <div className="account-menu-divider" />
          <MenuItem icon={FiLogOut} label="Çıkış Yap" danger onClick={handleLogout} />
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
