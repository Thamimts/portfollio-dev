const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const logger = require('morgan');


dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const frontendDir = path.join(__dirname, '../frontend');
const adminDir = path.join(__dirname, '../admin');

// Avoid conditional 304 responses on API endpoints that the dashboard expects to parse as JSON.
app.set('etag', false);

const projects = [
	{
		id: 1,
		title: 'E-Commerce App',
		description: 'Full-stack store with cart, auth, and Stripe payments.',
		stack: ['Html', 'Css', 'JavaScript'],
	},
	{
		id: 2,
		title: 'Quiz App',
		description: 'Quiz app with timer, scoring, and multiple categories.',
		stack: ['Html', 'Css', 'JavaScript'],
	},
	{
		id: 3,
		title: 'Weather App',
		description: 'Real-time weather information with accurate temperature and weather conditions.',
		stack: ['Html', 'Css', 'JavaScript', 'Node.js', 'OpenWeather API'],
	},
];

const skills = [
	'Html',
	'Css',
	'JavaScript',
	'Node.js',
	'MongoDB',
	'Express',
	'REST APIs',
	'Git',
	'GitHub',
	'Vercel',
	'Netlify',
];

const contactMessages = [];

let mongoClient;
let messagesCollection = null;

app.use(logger('dev'));

function buildMongoUri() {
	const username = process.env.MONGO_USERNAME ? encodeURIComponent(process.env.MONGO_USERNAME) : '';
	const password = process.env.MONGO_PASSWORD ? encodeURIComponent(process.env.MONGO_PASSWORD) : '';
	const cluster = process.env.MONGO_CLUSTER || '';

	if (username && password && cluster) {
		const databaseName = process.env.MONGO_DB_NAME || 'portfolio';
		const queryParts = ['retryWrites=true', 'w=majority'];

		if (process.env.MONGO_APP_NAME) {
			queryParts.push(`appName=${encodeURIComponent(process.env.MONGO_APP_NAME)}`);
		}

		return `mongodb+srv://${username}:${password}@${cluster}/${databaseName}?${queryParts.join('&')}`;
	}

	if (process.env.MONGO_URI) {
		return process.env.MONGO_URI;
	}

	return '';
}
app.use(helmet());
app.use(
	cors({
		origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
	})
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 100,
		standardHeaders: true,
		legacyHeaders: false,
	})
);

app.use('/api', (req, res, next) => {
	res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	res.set('Pragma', 'no-cache');
	res.set('Expires', '0');
	next();
});

app.use(express.static(frontendDir));
app.use('/admin', express.static(adminDir));

app.get('/admin', (req, res) => {
	res.sendFile(path.join(adminDir, 'admin.html'));
});

app.get('/', (req, res) => {
	res.sendFile(path.join(frontendDir, 'por.html'));
});

app.get('/api/health', (req, res) => {
	res.json({ ok: true, message: 'Server is running' });
});

app.get('/api/projects', (req, res) => {
	res.json(projects);
});

app.get('/api/skills', (req, res) => {
	res.json(skills);
});

app.get('/api/contact', (req, res) => {
	res.status(405).json({ error: 'Method not allowed. Use POST for contact submissions.' });
});

app.post('/api/contact', async (req, res) => {
	const name = String(req.body?.name || '').trim();
	const email = String(req.body?.email || '').trim();
	const message = String(req.body?.message || '').trim();

	if (!name || !email || !message) {
		return res.status(400).json({ error: 'Name, email, and message are required.' });
	}

	const entry = {
		name,
		email,
		message,
		createdAt: new Date(),
	};

	if (!process.env.DISCORD_WEBHOOK_URL) {
		return res.status(500).json({
			success: false,
			message: 'Discord webhook is not configured.',
		});
	}

	try {
		const webhookResponse = await fetch(process.env.DISCORD_WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				embeds: [
					{
						title: 'New Portfolio Contact',
						fields: [
							{
								name: 'Name',
								value: name,
								inline: false,
							},
							{
								name: 'Email',
								value: email,
								inline: false,
							},
							{
								name: 'Message',
								value: message,
								inline: false,
							},
						],
					},
				],
			}),
		});

		if (!webhookResponse.ok) {
			throw new Error(`Discord webhook request failed with status ${webhookResponse.status}`);
		}
	} catch (error) {
		console.error(error);
		return res.status(500).json({
			success: false,
			message: 'Failed to send message.',
		});
	}

	contactMessages.push(entry);

	if (messagesCollection) {
		try {
			await messagesCollection.insertOne(entry);
		} catch (error) {
			console.error('MongoDB save failed:', error.message);
		}
	}

	return res.status(201).json({
		message: 'Message received successfully.',
		contact: entry,
	});
});

app.get('/api/messages', async (req, res) => {
	const sortByNewest = (left, right) => new Date(right.createdAt) - new Date(left.createdAt);

	// If the server didn't connect to Mongo at startup (or was disconnected),
	// attempt an on-demand connection so the admin UI can still load live data.
	if (!messagesCollection) {
		try {
			await connectMongo();
		} catch (err) {
			// connectMongo logs details; fall back to in-memory messages below
		}
		if (!messagesCollection) {
			return res.json(contactMessages.slice().sort(sortByNewest));
		}
	}

	try {
		const messages = await messagesCollection.find({}).sort({ createdAt: -1 }).toArray();
		return res.json(messages);
	} catch (error) {
		console.error('MongoDB read failed:', error && error.message ? error.message : error);
		// If a read fails, clear messagesCollection so future calls will retry connectMongo.
		messagesCollection = null;
		return res.json(contactMessages.slice().sort(sortByNewest));
	}
});

app.delete('/api/messages/:id', async (req, res) => {
	const { id } = req.params;

	if (!id) {
		return res.status(400).json({ error: 'Message id is required.' });
	}

	if (!messagesCollection) {
		const beforeCount = contactMessages.length;
		const remainingMessages = contactMessages.filter((message) => String(message._id || message.id) !== String(id));

		if (remainingMessages.length === beforeCount) {
			return res.status(404).json({ error: 'Message not found.' });
		}

		contactMessages.length = 0;
		contactMessages.push(...remainingMessages);
		return res.json({ success: true, message: 'Message deleted successfully.' });
	}

	try {
		const deleteResult = await messagesCollection.deleteOne({ _id: new ObjectId(id) });

		if (!deleteResult.deletedCount) {
			return res.status(404).json({ error: 'Message not found.' });
		}

		return res.json({ success: true, message: 'Message deleted successfully.' });
	} catch (error) {
		console.error('MongoDB delete failed:', error.message);
		return res.status(500).json({ error: 'Failed to delete message.' });
	}
});

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

async function connectMongo() 
{
	const mongoUri = buildMongoUri();

	if (!mongoUri) {
		console.log('MongoDB connection details not set — skipping MongoDB connection.');
		return;
	}

	try {
		mongoClient = new MongoClient(mongoUri, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});

		await mongoClient.connect();
		const dbName = process.env.MONGO_DB_NAME || 'portfolio';
		messagesCollection = mongoClient.db(dbName).collection('messages');
		console.log(`MongoDB connected to database: ${dbName}`);
	} catch (err) {
		messagesCollection = null;
		console.warn('MongoDB connection failed:', err && err.message ? err.message : err);
		console.warn('Continuing without MongoDB. Set a valid MONGO_URI in .env to enable persistence.');
		try {
			if (mongoClient) await mongoClient.close();
		} catch (closeErr) {
			// ignore
		}
	}
}
async function startServer() {
	await connectMongo();

	app.listen(port, () => {
		console.log(`Portfolio server running on http://localhost:${port}`);
	});
}

startServer();
