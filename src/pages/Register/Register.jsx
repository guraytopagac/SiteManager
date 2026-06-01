// Libraries
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import "./Register.css";
import Swal from 'sweetalert2';

function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();

        if (username && email && password) {
            const response = await window.electronAPI.register({ username, email, password });

            if (response.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Kayıt Başarılı!',
                    text: response.message,
                    timer: 2500,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    heightAuto: false,
                    showClass: {
                        popup: 'animate__animated animate__fadeInDown'
                    }
                }).then(() => {
                    navigate("/");
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Kayıt Başarısız',
                    text: response.message,
                    confirmButtonText: 'Tamam',
                    confirmButtonColor: '#dc2626',
                    heightAuto: false
                });
            }
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Eksik Alan',
                text: 'Lütfen tüm alanları doldurun!',
                confirmButtonColor: '#f59e0b',
                heightAuto: false
            });
        }
    };

    return (
        <div className="registerContainer">
            <h1 className="title">Mavikent Site Yönetimi</h1>
            <h2 className="subtitle">Yeni Hesap Oluştur</h2>

            <form className="registerForm" onSubmit={handleRegisterSubmit}>
                <input
                    type="text"
                    id="userName"
                    placeholder="Kullanıcı adı belirleyin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <input
                    type="email"
                    id="userEmail"
                    placeholder="E-posta adresinizi girin"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    id="userPassword"
                    placeholder="Şifre belirleyin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit" id="registerButton">Kayıt Ol</button>
            </form>

            <p className="infoText">
                Zaten bir hesabınız var mı?{' '}
                <Link to="/">Giriş yapın</Link>
            </p>
        </div>
    );
}

export default Register;