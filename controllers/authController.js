const { admin } = require('../utils/firebase');

exports.setUserRole = async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ success: false, error: 'UID required' });
    }
    
    const userRecord = await admin.auth().getUser(uid);
    
    // Everyone gets "applicant" role by default
    await admin.auth().setCustomUserClaims(uid, { role: 'applicant' });
    
    console.log(`New user: ${userRecord.email} → applicant`);
    
    res.json({ success: true, role: 'applicant' });
  } catch (error) {
    console.error('Error setting role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserInfo = async (req, res) => {
  res.json({ success: true, user: req.user });
};