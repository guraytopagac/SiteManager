// Deleted buildings, with restoring and permanent removal. Kept in a modal so the picker card keeps one height
// however many buildings were deleted.

import { FiX } from "react-icons/fi";
import "./SelectBuildingModals.css";
import Pager from "@/components/Pager/Pager";
import { showDialog } from "@/components/Dialog/dialogStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePagination } from "@/hooks/usePagination";
import { useSession, clearCurrentBuilding, useCurrentBuilding } from "@/hooks/useSession";

// Chosen so the box fits the smallest window without its body scrolling.
const PAGE_SIZE = 4;

function DeletedBuildingsModal({ buildings, onClose, onChanged }) {
  const session = useSession();
  const selectedBuilding = useCurrentBuilding();
  const { pageItems, currentPage, pageCount, setPage } = usePagination(buildings, PAGE_SIZE);
  // Short pages are topped up with hidden rows, so the box keeps one height across pages.
  const spacerCount = PAGE_SIZE - pageItems.length;

  useEscapeKey(onClose);

  const handleRestore = async (building) => {
    const confirmed = await showDialog.confirm(
      "Binayı Geri Getir",
      `"${building.name}" yeniden bina listesine eklenecek.`,
      "Vazgeç",
      "Geri Getir",
    );
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.updateBuildingStatus({
        buildingId: building.id,
        ownerId: session.id,
        isActive: true,
      });

      if (res.success) {
        onChanged();
        showDialog.toast(res.message);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[DeletedBuildingsModal] updateBuildingStatus:", err);
      showDialog.error("Hata", "Bina geri getirilemedi. Lütfen tekrar deneyin.");
    }
  };

  // The stored selection is cleared as well, since the guard only checks the store and a stale entry would
  // keep letting records into a gone building.
  const handleRemove = async (building) => {
    const confirmed = await showDialog.confirmDanger(
      "Binayı Kalıcı Olarak Sil",
      `"${building.name}" listeden tamamen kaldırılacak ve bir daha geri getirilemeyecek.`,
      "Vazgeç",
      "Evet, Sil",
    );
    if (!confirmed) return;

    try {
      const res = await window.electronAPI.removeBuilding({ buildingId: building.id, ownerId: session.id });

      if (res.success) {
        if (selectedBuilding?.id === building.id) {
          clearCurrentBuilding();
        }
        onChanged();
        showDialog.toast(res.message);
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[DeletedBuildingsModal] removeBuilding:", err);
      showDialog.error("Hata", "Bina kalıcı olarak silinemedi. Lütfen tekrar deneyin.");
    }
  };

  return (
    <div className="sb-md-overlay">
      <div className="sb-md-box" role="dialog" aria-modal="true" aria-labelledby="sb-md-title">
        <div className="sb-md-head">
          <div className="sb-md-identity">
            <h2 className="sb-md-title" id="sb-md-title">
              Silinen Binalar
            </h2>
            <span className="sb-md-scope">{buildings.length} bina</span>
          </div>
          <button type="button" className="sb-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="sb-md-body">
          <div className="sb-md-slot">
            <div className="sb-md-list" aria-hidden={buildings.length === 0 ? true : undefined}>
              {pageItems.map((building) => (
                <div key={building.id} className="sb-md-row">
                  <span className="sb-md-name" title={building.name}>
                    {building.name}
                  </span>
                  <span className="sb-md-actions">
                    <button
                      type="button"
                      className="sb-md-btn"
                      onClick={() => handleRestore(building)}
                      aria-label={`${building.name} binasını geri getir`}
                    >
                      Geri Getir
                    </button>
                    <button
                      type="button"
                      className="sb-md-btn sb-md-btn--danger"
                      onClick={() => handleRemove(building)}
                      aria-label={`${building.name} binasını kalıcı olarak sil`}
                    >
                      Kalıcı Sil
                    </button>
                  </span>
                </div>
              ))}
              {Array.from({ length: spacerCount }, (_, index) => (
                <div key={`spacer-${index}`} className="sb-md-row sb-md-row--spacer" aria-hidden="true">
                  <span className="sb-md-btn">&nbsp;</span>
                </div>
              ))}
            </div>
            {buildings.length === 0 && <p className="sb-md-empty">Silinen bina kalmadı.</p>}
          </div>
          <Pager currentPage={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}

export default DeletedBuildingsModal;
