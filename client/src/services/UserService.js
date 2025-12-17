import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, remove, update, onValue, off } from "firebase/database";

/**
 * Crea un nuevo usuario en Firebase Auth y Realtime DB
 * Usa la API REST de Firebase para evitar cerrar la sesión del admin
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña
 * @param {string} role - 'admin' o 'user'
 * @returns {Promise<Object>} - Datos del usuario creado
 */
export const createUser = async (email, password, role = 'user') => {
    try {
        const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;

        // Crear usuario usando Firebase REST API
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    returnSecureToken: true
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Error creating user');
        }

        const uid = data.localId;

        // Guardar datos adicionales en Realtime DB
        await set(ref(db, `users/${uid}`), {
            email: email,
            role: role,
            createdAt: new Date().toISOString()
        });

        return {
            uid: uid,
            email: email,
            role: role
        };
    } catch (error) {
        console.error("Error creating user:", error);
        throw error;
    }
};

/**
 * Obtiene la lista de todos los usuarios
 * @returns {Promise<Array>} - Array de usuarios
 */
/**
 * Escucha cambios en tiempo real de todos los usuarios
 * @param {function} callback - Función a ejecutar con los datos actualizados
 * @returns {function} - Función para cancelar la suscripción
 */
export const listenToAllUsers = (callback) => {
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            const usersList = Object.keys(usersData).map(uid => ({
                uid,
                ...usersData[uid]
            })).sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA;
            });
            callback(usersList);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error listening to users:", error);
    });

    return () => off(usersRef);
};

/**
 * Obtiene la lista de todos los usuarios
 * @returns {Promise<Array>} - Array de usuarios
 */
export const getAllUsers = async () => {
    try {
        const snapshot = await get(ref(db, 'users'));
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            return Object.keys(usersData).map(uid => ({
                uid,
                ...usersData[uid]
            })).sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA; // Descending
            });
        }
        return [];
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
};

/**
 * Actualiza el rol de un usuario
 * @param {string} uid - ID del usuario
 * @param {string} newRole - Nuevo rol
 */
export const updateUserRole = async (uid, newRole) => {
    try {
        await set(ref(db, `users/${uid}/role`), newRole);
    } catch (error) {
        console.error("Error updating user role:", error);
        throw error;
    }
};

/**
 * Elimina un usuario de la base de datos
 * Nota: No elimina de Firebase Auth (requiere Cloud Functions)
 * @param {string} uid - ID del usuario
 */
export const deleteUserData = async (uid) => {
    try {
        await remove(ref(db, `users/${uid}`));
    } catch (error) {
        console.error("Error deleting user:", error);
        throw error;
    }
};

/**
 * Actualiza la fecha de última actividad del usuario
 * @param {string} uid - ID del usuario
 */
export const updateUserActivity = async (uid) => {
    if (!uid) return;
    try {
        await update(ref(db, `users/${uid}`), {
            lastActive: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error updating user activity:", error);
    }
};
