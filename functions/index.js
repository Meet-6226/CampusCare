const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Cloud Function to send push notifications to all subscribed users
 * HTTP endpoint: POST /sendNotification
 * Body: { title: string, body: string, data?: object }
 * Updated: Fixed icon/badge field placement for Firebase Admin SDK compatibility
 */
exports.sendNotification = onRequest({cors: true}, async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    const {title, body, data = {}} = req.body;

    // Validate required fields
    if (!title || !body) {
      return res.status(400).json({
        error: "Missing required fields: title and body are required",
      });
    }

    // Create the notification payload
    const message = {
      notification: {
        title: title,
        body: body,
      },
      webpush: {
        notification: {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        },
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        click_action: data.click_action || "/",
      },
      topic: "all", // Send to all users subscribed to "all" topic
    };

    // Send the notification
    const response = await admin.messaging().send(message);
    
    logger.info("Notification sent successfully:", {
      messageId: response,
      title,
      body,
      timestamp: new Date().toISOString(),
    });

    // Store notification in Firestore for history
    await admin.firestore().collection("notifications").add({
      title,
      body,
      data,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: response,
      status: "sent",
    });

    return res.status(200).json({
      success: true,
      messageId: response,
      message: "Notification sent successfully to all users",
    });
  } catch (error) {
    logger.error("Error sending notification:", error);
    
    // Store failed notification in Firestore
    await admin.firestore().collection("notifications").add({
      title: req.body.title || "Unknown",
      body: req.body.body || "Unknown",
      data: req.body.data || {},
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "failed",
      error: error.message,
    });

    return res.status(500).json({
      error: "Failed to send notification",
      details: error.message,
    });
  }
});

/**
 * Cloud Function to send targeted notifications to specific users
 * HTTP endpoint: POST /sendTargetedNotification
 * Body: { title: string, body: string, tokens: string[], data?: object }
 */
exports.sendTargetedNotification = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    const {title, body, tokens, data = {}} = req.body;

    if (!title || !body || !tokens || !Array.isArray(tokens)) {
      return res.status(400).json({
        error: "Missing required fields: title, body, and tokens array are required",
      });
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      webpush: {
        notification: {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        },
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
        click_action: data.click_action || "/",
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    
    logger.info("Targeted notification sent:", {
      successCount: response.successCount,
      failureCount: response.failureCount,
      title,
      body,
    });

    // Store notification in Firestore
    await admin.firestore().collection("notifications").add({
      title,
      body,
      data,
      targetTokens: tokens,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      successCount: response.successCount,
      failureCount: response.failureCount,
      status: "sent",
      type: "targeted",
    });

    return res.status(200).json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      message: "Targeted notification sent successfully",
    });
  } catch (error) {
    logger.error("Error sending targeted notification:", error);
    return res.status(500).json({
      error: "Failed to send targeted notification",
      details: error.message,
    });
  }
});

/**
 * Cloud Function to get notification history
 * HTTP endpoint: GET /getNotificationHistory
 */
exports.getNotificationHistory = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    const limit = parseInt(req.query.limit) || 50;
    const snapshot = await admin.firestore()
        .collection("notifications")
        .orderBy("sentAt", "desc")
        .limit(limit)
        .get();

    const notifications = [];
    snapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null,
      });
    });

    return res.status(200).json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    logger.error("Error fetching notification history:", error);
    return res.status(500).json({
      error: "Failed to fetch notification history",
      details: error.message,
    });
  }
});

/**
 * Cloud Function to subscribe a token to a topic
 * HTTP endpoint: POST /subscribeToTopic
 * Body: { token: string, topic: string }
 */
exports.subscribeToTopic = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }

  try {
    const {token, topic} = req.body;

    if (!token || !topic) {
      return res.status(400).json({
        error: "Missing required fields: token and topic are required",
      });
    }

    // Subscribe the token to the topic
    await admin.messaging().subscribeToTopic(token, topic);

    logger.info("Token subscribed to topic:", {token, topic});

    return res.status(200).json({
      success: true,
      message: `Successfully subscribed to topic: ${topic}`,
    });
  } catch (error) {
    logger.error("Error subscribing to topic:", error);
    return res.status(500).json({
      error: "Failed to subscribe to topic",
      details: error.message,
    });
  }
});
