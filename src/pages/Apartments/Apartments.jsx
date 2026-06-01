import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Apartments.css';

function Apartments() {
    const navigate = useNavigate();
    const [apartments, setApartments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchApartments = async () => {
            const response = await window.electronAPI.getApartments();
            if (response.success) {
                setApartments(response.data);
            }
            setLoading(false);
        };
        fetchApartments();
    }, []);

    if (loading) return <div className="loading">Verileriniz Yükleniyor...</div>;

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