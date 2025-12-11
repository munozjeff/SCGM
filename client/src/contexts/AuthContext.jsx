import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { ref, get, child } from "firebase/database";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin' | 'user' | null
    const [loading, setLoading] = useState(true);

    // Login function
    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    // Logout function
    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch role from Realtime DB: users/{uid}/role
                try {
                    const snapshot = await get(child(ref(db), `users/${user.uid}`));
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        setUserRole(userData.role || 'user');
                    } else {
                        // Default or error handling if user not in DB
                        setUserRole('user');
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setUserRole('user');
                }
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userRole,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
