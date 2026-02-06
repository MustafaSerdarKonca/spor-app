/**
 * Firestore Database Helper
 */
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Collection structure: users/{userId}/days/{dayId}

export const getDay = async (userId, dayId) => {
    try {
        const docRef = doc(db, "users", userId, "days", dayId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting document:", error);
        throw error;
    }
};

export const saveDay = async (userId, dayData) => {
    try {
        // Ensure dayId is present
        if (!dayData.dayId) throw new Error("DayData must have dayId");

        const docRef = doc(db, "users", userId, "days", dayData.dayId);
        await setDoc(docRef, dayData);
        console.log("Document saved");
    } catch (error) {
        console.error("Error saving document:", error);
        throw error;
    }
};

// No longer exporting initDB as Firebase SDK handles it.
export const initDB = () => Promise.resolve(); 
