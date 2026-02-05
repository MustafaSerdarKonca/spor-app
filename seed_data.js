import { saveDay } from './js/db.js';

const mockData = {
    dayId: 'mon',
    exercises: [
        { id: '1', name: 'Smith Machine Squat', tag: 'Leg', note: '', history: [20, 17.5, 15] },
        { id: '2', name: 'Leg Press', tag: 'Leg', note: '', history: [100] },
        { id: '3', name: 'Leg Extension', tag: 'Leg', note: '', history: [50] },
        { id: '4', name: 'Seated Leg Curl', tag: 'Leg', note: '', history: [60] },
        { id: '5', name: 'Cable Crunch / Calf Raise', tag: 'Abs/Calf', note: '', history: [40, 37.5] },
        { id: '6', name: 'Total Abdominal', tag: 'Abs', note: '', history: [85, 80, 75] },
        { id: '7', name: 'Torso Rotation', tag: 'Core', note: '', history: [65, 62.5, 55] }
    ]
};

saveDay(mockData).then(() => console.log('Mock Data Seeded!'));
