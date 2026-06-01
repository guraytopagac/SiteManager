import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ cash: 0, collections: 0, delays: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            const data = await window.electronAPI.getStats();
            if (data.success) {
                setStats(data.payload);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="dashboard-container">
            <div className="stat-grid">
                <div className="stat-card" style={{ backgroundColor: '#059669' }}>
                    <h3>Kasa</h3>
                    <p>12.450 ₺</p>
                </div>
                <div className="stat-card" style={{ backgroundColor: '#2563eb' }}>
                    <h3>Tahsilat</h3>
                    <p>%85</p>
                </div>
                <div className="stat-card" style={{ backgroundColor: '#dc2626' }}>
                    <h3>Gecikme</h3>
                    <p>4.200 ₺</p>
                </div>
            </div>

            <div className="category-group">
                <h2 className="sectionHeader">Daire İşlemleri</h2>
                <div className="action-grid">
                    <div className="action-card" onClick={() => navigate('/add-apartment')}>
                        <h4>Yeni Daire Ekle</h4>
                    </div>
                    <div className="action-card" onClick={() => navigate('/apartments')}>
                        <h4>Mevcut Daireleri Görüntüle</h4>
                    </div>
                </div>
            </div>

            <div className="category-group">
                <h2 className="sectionHeader">Finansal İşlemler</h2>
                <div className="action-grid">
                    <div className="action-card" onClick={() => navigate('/add-expense')}>
                        <h4>Gider Ekle</h4>
                    </div>
                    <div className="action-card" onClick={() => navigate('/add-due')}>
                        <h4>Aidat Gir</h4>
                    </div>
                </div>
            </div>

            <div className="category-group">
                <h2 className="sectionHeader">Çeşitli</h2>
                <div className="action-grid">
                    <div className="action-card" onClick={() => navigate('/send-announcement')}>
                        <h4>Duyuru Gönder</h4>
                    </div>
                    <div className="action-card" onClick={() => navigate('/reports')}>
                        <h4>PDF Raporu</h4>
                    </div>
                </div>
            </div>

            <hr style={{ margin: '40px 0', opacity: 0.2 }} />

            <div className="return-link">
                <button onClick={() => navigate('/')} className="button">
                    Geri Dön
                </button>
            </div>
        </div>
    );
}

export default Dashboard;