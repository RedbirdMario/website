const User = require('./User');
const Client = require('./Client');
const Property = require('./Property');
const ClientProperty = require('./ClientProperty');
const ProgressPhase = require('./ProgressPhase');
const ProgressStep = require('./ProgressStep');
const ClientProgress = require('./ClientProgress');
const Document = require('./Document');
const ClientDocument = require('./ClientDocument');
const Media = require('./Media');
const PropertyMedia = require('./PropertyMedia');
const Notification = require('./Notification');
const Message = require('./Message');
const RefreshToken = require('./RefreshToken');

// User - Client association
Client.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

Client.belongsTo(User, {
  foreignKey: 'advisor_id',
  as: 'advisor'
});

// Client - Property association (many-to-many through ClientProperty)
Client.belongsToMany(Property, {
  through: ClientProperty,
  foreignKey: 'client_id',
  otherKey: 'property_id'
});

Property.belongsToMany(Client, {
  through: ClientProperty,
  foreignKey: 'property_id',
  otherKey: 'client_id'
});

// Direct access to the join table
Client.hasMany(ClientProperty, {
  foreignKey: 'client_id'
});

ClientProperty.belongsTo(Client, {
  foreignKey: 'client_id'
});

Property.hasMany(ClientProperty, {
  foreignKey: 'property_id'
});

ClientProperty.belongsTo(Property, {
  foreignKey: 'property_id'
});

// Progress Tracking
ProgressPhase.hasMany(ProgressStep, {
  foreignKey: 'phase_id',
  as: 'steps'
});

ProgressStep.belongsTo(ProgressPhase, {
  foreignKey: 'phase_id',
  as: 'phase'
});

ClientProperty.hasMany(ClientProgress, {
  foreignKey: 'client_property_id',
  as: 'progress'
});

ClientProgress.belongsTo(ClientProperty, {
  foreignKey: 'client_property_id',
  as: 'clientProperty'
});

ProgressStep.hasMany(ClientProgress, {
  foreignKey: 'step_id',
  as: 'clientSteps'
});

ClientProgress.belongsTo(ProgressStep, {
  foreignKey: 'step_id',
  as: 'step'
});

// Document Management
User.hasMany(Document, {
  foreignKey: 'uploaded_by',
  as: 'uploadedDocuments'
});

Document.belongsTo(User, {
  foreignKey: 'uploaded_by',
  as: 'uploader'
});

Client.belongsToMany(Document, {
  through: ClientDocument,
  foreignKey: 'client_id',
  otherKey: 'document_id'
});

Document.belongsToMany(Client, {
  through: ClientDocument,
  foreignKey: 'document_id',
  otherKey: 'client_id'
});

Property.hasMany(ClientDocument, {
  foreignKey: 'property_id',
  as: 'documents'
});

ClientDocument.belongsTo(Property, {
  foreignKey: 'property_id',
  as: 'property'
});

Client.hasMany(ClientDocument, {
  foreignKey: 'client_id',
  as: 'documents'
});

ClientDocument.belongsTo(Client, {
  foreignKey: 'client_id',
  as: 'client'
});

Document.hasMany(ClientDocument, {
  foreignKey: 'document_id',
  as: 'clientDocuments'
});

ClientDocument.belongsTo(Document, {
  foreignKey: 'document_id',
  as: 'document'
});

// Media Management
User.hasMany(Media, {
  foreignKey: 'uploaded_by',
  as: 'uploadedMedia'
});

Media.belongsTo(User, {
  foreignKey: 'uploaded_by',
  as: 'uploader'
});

Property.belongsToMany(Media, {
  through: PropertyMedia,
  foreignKey: 'property_id',
  otherKey: 'media_id'
});

Media.belongsToMany(Property, {
  through: PropertyMedia,
  foreignKey: 'media_id',
  otherKey: 'property_id'
});

Property.hasMany(PropertyMedia, {
  foreignKey: 'property_id',
  as: 'propertyMedia'
});

PropertyMedia.belongsTo(Property, {
  foreignKey: 'property_id',
  as: 'property'
});

Media.hasMany(PropertyMedia, {
  foreignKey: 'media_id',
  as: 'propertyMedia'
});

PropertyMedia.belongsTo(Media, {
  foreignKey: 'media_id',
  as: 'media'
});

// Notifications
User.hasMany(Notification, {
  foreignKey: 'user_id',
  as: 'notifications'
});

Notification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Messages
User.hasMany(Message, {
  foreignKey: 'sender_id',
  as: 'sentMessages'
});

Message.belongsTo(User, {
  foreignKey: 'sender_id',
  as: 'sender'
});

User.hasMany(Message, {
  foreignKey: 'recipient_id',
  as: 'receivedMessages'
});

Message.belongsTo(User, {
  foreignKey: 'recipient_id',
  as: 'recipient'
});

Message.belongsTo(Message, {
  foreignKey: 'parent_message_id',
  as: 'parentMessage'
});

Message.hasMany(Message, {
  foreignKey: 'parent_message_id',
  as: 'replies'
});

// Refresh Tokens
User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
  as: 'refreshTokens'
});

RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Export models
module.exports = {
  User,
  Client,
  Property,
  ClientProperty,
  ProgressPhase,
  ProgressStep,
  ClientProgress,
  Document,
  ClientDocument,
  Media,
  PropertyMedia,
  Notification,
  Message,
  RefreshToken
};