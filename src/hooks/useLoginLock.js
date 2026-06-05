import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export function useLoginLock(maxAttempts = 5, lockDurationMinutes = 5) {
    const [isLocked, setIsLocked] = useState(false);
    const [remainingTime, setRemainingTime] = useState(0);

    useEffect(() => {
        const checkLockStatus = () => {
            const lockUntil = localStorage.getItem('loginLockUntil');
            if (lockUntil) {
                const now = Date.now();
                const timeLeft = Math.ceil((parseInt(lockUntil) - now) / 1000);

                if (timeLeft > 0) {
                    setIsLocked(true);
                    setRemainingTime(timeLeft);
                } else {
                    resetLock();
                }
            }
        };

        checkLockStatus();

        let interval;
        if (isLocked && remainingTime > 0) {
            interval = setInterval(() => {
                setRemainingTime((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        resetLock();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [isLocked, remainingTime]);

    const resetLock = () => {
        localStorage.removeItem('loginLockUntil');
        localStorage.setItem('loginAttempts', '0');
        setIsLocked(false);
        setRemainingTime(0);
    };

    const handleFailedAttempt = (message) => {
        const currentAttempts = parseInt(localStorage.getItem('loginAttempts') || '0') + 1;
        localStorage.setItem('loginAttempts', currentAttempts.toString());

        if (currentAttempts >= maxAttempts) {
            const lockTime = Date.now() + lockDurationMinutes * 60 * 1000;
            localStorage.setItem('loginLockUntil', lockTime.toString());
            setIsLocked(true);
            setRemainingTime(lockDurationMinutes * 60);

            Swal.fire({
                icon: 'error',
                title: 'Hesabınız Kilitlendi!',
                text: `${maxAttempts} defa hatalı giriş yaptığınız için sistem ${lockDurationMinutes} dakika kapatılmıştır.`,
                confirmButtonText: 'Tamam',
                confirmButtonColor: '#ef4444',
                heightAuto: false
            });
        } else {
            const remainingAttempts = maxAttempts - currentAttempts;
            Swal.fire({
                icon: 'error',
                title: 'Giriş Başarısız',
                text: `${message} (Kalan Giriş Hakkınız: ${remainingAttempts})`,
                confirmButtonText: 'Tamam',
                confirmButtonColor: '#3b82f6',
                heightAuto: false
            });
        }
    };

    const formatTime = () => {
        const mins = Math.floor(remainingTime / 60);
        const secs = remainingTime % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return {
        isLocked,
        remainingTime: formatTime(),
        handleFailedAttempt,
        resetLock
    };
}