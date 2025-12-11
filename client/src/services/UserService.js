import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, remove } from "firebase/database";

/**
 * Crea un nuevo usuario en Firebase Auth y Realtime DB
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña
 * @param {string} role - 'admin' o 'user'
 * @returns {Promise<Object>} - Datos del usuario creado
 */
export const createUser = async (email, password, role = 'user') => {
    try {
        // Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Guardar datos adicionales en Realtime DB
        await set(ref(db, `users/${user.uid}`), {
            email: email,
            role: role,
            createdAt: new Date().toISOString()
        });

        return {
            uid: user.uid,
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
export const getAllUsers = async () => {
    try {
        const snapshot = await get(ref(db, 'users'));
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            return Object.keys(usersData).map(uid => ({
                uid,
                ...usersData[uid]
            }));
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
