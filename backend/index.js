const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('API lista'));

app.listen(3000, () => console.log('Backend en http://localhost:3000'));