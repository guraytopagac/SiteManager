import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import "./AddExpense.css"; // Yeni oluşturduğumuz gider stilini import ettik

function AddExpense() {
    const navigate = useNavigate();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();

        const cleanDescription = description.trim();

        if (Number(amount) <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Geçersiz Miktar',
                text: "Gider miktarı 0'dan büyük olmalıdır!",
                confirmButtonColor: '#f59e0b',
                heightAuto: false
            });
            return;
        }

        const currentUserRaw = sessionStorage.getItem('currentUser');
        if (!currentUserRaw) {
            Swal.fire({
                icon: 'error',
                title: 'Oturum Hatası',
                text: 'Yönetici bilgisi bulunamadı. Lütfen tekrar giriş yapın.',
                confirmButtonColor: '#dc2626',
                heightAuto: false
            });
            return;
        }

        const currentUser = JSON.parse(currentUserRaw);
        const managerId = currentUser.id;

        const today = new Date().toISOString().split('T')[0];

        if (amount && cleanDescription) {
            // Electron API üzerinden gider ekleme kanalını tetikliyoruz
            const response = await window.electronAPI.addExpense({
                amount: Number(amount),
                description: cleanDescription,
                date: today,
                manager_id: managerId
            });

            if (response.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Gider Eklendi!',
                    text: response.message || 'Gider kaydı başarıyla oluşturuldu.',
                    timer: 2000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    heightAuto: false
                });
                setAmount('');
                setDescription('');
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Hata Oluştu',
                    text: response.message || 'Gider kaydedilemedi.',
                    confirmButtonText: 'Tamam',
                    confirmButtonColor: '#dc2626',
                    heightAuto: false
                });
            }
        } else {
            Swal.fire('Uyarı', 'Lütfen tüm alanları doldurun!', 'warning');
        }
    };

    return (
        <div className="expense-wrapper">
            <div className="expenseContainer">
                <h2 className="title">Yeni Gider Ekle</h2>

                <form className="expenseForm" onSubmit={handleExpenseSubmit}>
                    <div className="formGroup">
                        <label htmlFor="expenseAmount">Gider Miktarı (₺)</label>
                        <input
                            type="number"
                            id="expenseAmount"
                            step="0.01"
                            min="0.01"
                            placeholder="Miktar girin (Örn: 450.00)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="formGroup">
                        <label htmlFor="expenseDescription">Açıklama</label>
                        <textarea
                            id="expenseDescription"
                            placeholder="Giderin detayını yazın (Örn: Çevre aydınlatma ampul değişimi)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" id="expenseButton">
                        Gideri Kaydet
                    </button>
                    <button type="button" id="backButton" onClick={() => navigate('/dashboard')}>
                        Geri Dön
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AddExpense;