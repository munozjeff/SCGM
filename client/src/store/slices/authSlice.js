import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, get, child } from 'firebase/database';
import { auth, db } from '../../firebase';

// Async thunk para login
export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ email, password }, { rejectWithValue }) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Obtener rol del usuario
            const snapshot = await get(child(ref(db), `users/${user.uid}`));
            const userData = snapshot.exists() ? snapshot.val() : { role: 'user' };

            return {
                uid: user.uid,
                email: user.email,
                role: userData.role
            };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Async thunk para logout
export const logoutUser = createAsyncThunk(
    'auth/logout',
    async (_, { rejectWithValue }) => {
        try {
            await signOut(auth);
            return null;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Async thunk para verificar sesión actual
export const checkAuthState = createAsyncThunk(
    'auth/checkState',
    async (_, { rejectWithValue }) => {
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                unsubscribe();
                if (user) {
                    try {
                        const snapshot = await get(child(ref(db), `users/${user.uid}`));
                        const userData = snapshot.exists() ? snapshot.val() : { role: 'user' };
                        resolve({
                            uid: user.uid,
                            email: user.email,
                            role: userData.role
                        });
                    } catch (error) {
                        reject(error.message);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        role: null,
        loading: true,
        error: null
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.role = action.payload?.role;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Logout
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.role = null;
                state.loading = false;
                state.error = null;
            })
            // Check Auth State
            .addCase(checkAuthState.pending, (state) => {
                state.loading = true;
            })
            .addCase(checkAuthState.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.role = action.payload?.role;
            })
            .addCase(checkAuthState.rejected, (state) => {
                state.loading = false;
                state.user = null;
                state.role = null;
            });
    }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
