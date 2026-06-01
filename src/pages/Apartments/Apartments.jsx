import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Apartments.css';

function Apartments() {
    const navigate = useNavigate();
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchApartments = async () => {
            const storedUser = sessionStorage.getItem('currentUser');

            if (!storedUser) {
                setErrorMessage('Oturum bilginiz bulunamadı. Lütfen tekrar giriş yapın.');
                setLoading(false);
                navigate('/', { replace: true });
                return;
            }

            try {
                const currentUser = JSON.parse(storedUser);
                const userId = currentUser?.id;

                if (!userId) {
                    setErrorMessage('Geçerli kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
                    setLoading(false);
                    navigate('/', { replace: true });
                    return;
                }

                const response = await window.electronAPI.getApartments(userId);
                if (response.success) {
                    setApartments(response.data);
                } else {
                    setErrorMessage(response.message || 'Daire listesi alınamadı.');
                }
            } catch {
                setErrorMessage('Kullanıcı bilgisi okunamadı. Lütfen tekrar giriş yapın.');
                navigate('/', { replace: true });
            } finally {
                setLoading(false);
            }
        };
        fetchApartments();
    }, [navigate]);

    if (loading) return <div className="loading">Verileriniz Yükleniyor...</div>;

    if (errorMessage) return <div className="loading">{errorMessage}</div>;

    return (
        <div className="apartments-container">
            <h2>Daire Listesi</h2>
            <table className="apartment-table">
                <thead>
                    <tr>
                        <th>Daire No</th>
                        <th>Kat</th>
                        <th>Tip</th>
                        <th>m²</th>
                        <th>Aidat</th>
                    </tr>
                </thead>
                <tbody>
                    {apartments.map((apt) => (
                        <tr key={apt.id}>
                            <td>{apt.apartment_no}</td>
                            <td>{apt.floor}</td>
                            <td>{apt.type}</td>
                            <td>{apt.square_meters}</td>
                            <td>{apt.due_amount} ₺</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <hr style={{ margin: '40px 0', opacity: 0.2 }} />

            <div className="return-link">
                <button onClick={() => navigate('/dashboard')} className="button">
                    Geri Dön
                </button>
            </div>
        </div>
    );
}

export default Apartments;
