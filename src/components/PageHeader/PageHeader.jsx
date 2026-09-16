import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import "./PageHeader.css";
import AccountMenu from "@/components/AccountMenu/AccountMenu";
import { useCurrentBuilding } from "@/hooks/useSession";

function PageHeader({ title }) {
  const navigate = useNavigate();
  const building = useCurrentBuilding();

  return (
    <header className="page-band page-header">
      <div className="page-header-top">
        <button
          type="button"
          className="page-header-back"
          onClick={() => navigate(building ? "/dashboard" : "/select-building")}
        >
          <FiArrowLeft />
          {building ? "Panoya Dön" : "Bina Seçimine Dön"}
        </button>
        <AccountMenu />
      </div>
      <div className="page-header-main">
        <h1 className="page-header-title">{title}</h1>
        {building ? (
          <span className="page-header-building" title={building.name}>
            {building.name}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export default PageHeader;
