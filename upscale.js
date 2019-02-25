const fs = require('fs');
const sharp = require('sharp');
const { spawn } = require('child_process');
const path = require('path');

const gameKey = process.argv[2].toUpperCase();
const folderPath = `${__dirname}/input/${gameKey}`;

let ignoreList = [];
let includeList = [];
const fmvList = includeList = fs.readFileSync(`fmv_resolutions.txt`).toString().replace(/\r/g, '').split('\n');

// Load game specific exceptions
if (fs.existsSync(`ignore/${gameKey}.txt`)) {
	ignoreList = fs.readFileSync(`ignore/${gameKey}.txt`).toString().replace(/\r/g, '').split('\n');
}

if (fs.existsSync(`include/${gameKey}.txt`)) {
	includeList = fs.readFileSync(`include/${gameKey}.txt`).toString().replace(/\r/g, '').split('\n');
}

const outputPath = `${__dirname}/output/${gameKey}-output`;

path.sep = '/';
const testPyPath = path.normalize(path.resolve(__dirname, 'node_modules', 'esrgan', 'test.py'));
const modelPath = path.normalize(path.resolve(__dirname, 'node_modules', 'esrgan', 'models', 'manga.pth'));

try {
	fs.mkdirSync(outputPath);
	fs.mkdirSync(`${outputPath}/alpha`);
	fs.mkdirSync(`${outputPath}/alphachannel`);
	fs.mkdirSync(`${outputPath}/alphachannel-processed`);
	fs.mkdirSync(`${outputPath}/alpha-processed`);
	fs.mkdirSync(`${outputPath}/nonalpha`);
	fs.mkdirSync(`${outputPath}/nonalpha-final`);
	fs.mkdirSync(`${outputPath}/alpha-final`);
	fs.mkdirSync(`${outputPath}/ignored`);
	fs.mkdirSync(`${outputPath}/fmv`);
} catch {
	// Let these fail silently
}

const esrganNonalpha = async () => {
	console.log('Starting ESRGAN for non-alpha textures');
	const child = spawn('python', [testPyPath, modelPath, `${outputPath}/nonalpha`, `${outputPath}/nonalpha-final`]);

	child.stdout.pipe(process.stdout);
	child.stderr.pipe(process.stderr);

	child.on('close', (code) => {
		console.log(`child process exited with code ${code}`);

		if (parseInt(code) === 0) {
			esrganAlpha();
		}
	});
};

const esrganAlpha = async () => {
	console.log('Starting ESRGAN for alpha textures');
	const child = spawn('python', [testPyPath, modelPath, `${outputPath}/alpha`, `${outputPath}/alpha-processed`]);

	child.stdout.pipe(process.stdout);
	child.stderr.pipe(process.stderr);

	child.on('close', (code) => {
		console.log(`child process exited with code ${code}`);

		if (parseInt(code) === 0) {
			esrganAlphaChannel();
		}
	});
};

const esrganAlphaChannel = async () => {
	console.log('Starting ESRGAN for separated alpha channels');
	const child = spawn('python', [testPyPath, modelPath, `${outputPath}/alphachannel`, `${outputPath}/alphachannel-processed`]);

	child.stdout.pipe(process.stdout);
	child.stderr.pipe(process.stderr);

	child.on('close', (code) => {
		console.log(`child process exited with code ${code}`);

		if (parseInt(code) === 0) {
			combineAlphaChannels();
		}
	});
};

const combineAlphaChannels = async () => {
	const files = fs.readdirSync(`${outputPath}/alpha-processed`);

	console.log(`Combining alpha into ${files.length} textures.`)

	let file;
	for (let i = 0; i < files.length; i++) {
		file = files[i];
		console.log(`Merging #${i}/${files.length} ${file}`);

		const imagePath = `${outputPath}/alpha-processed/${file}`;
		const alphaPath = `${outputPath}/alphachannel-processed/${file}`;

		await combine(imagePath, alphaPath, file);
	}
};

const combine = async (imagePath, alphaPath, file) => {
	const metadata = await sharp(alphaPath).metadata();
	// Gamma correction is used to compensate for noise added by ESRGAN
	const alpha = await sharp(alphaPath).toColourspace('b-w').gamma(2.2).raw().toBuffer();

	await sharp(imagePath).joinChannel(alpha, {raw: {
		width: metadata.width,
		height: metadata.height,
		channels: 1,
	 }}).toFile(`${outputPath}/alpha-final/${file}`);
};

const isMonoColor = (stats) => {
	return stats.channels[0].min === stats.channels[0].max &&
		stats.channels[1].min === stats.channels[1].max &&
		stats.channels[2].min === stats.channels[2].max &&
		(!stats.channels[3] || (stats.channels[3].min === stats.channels[3].max));
};

const hasAlphaChannel = (stats) => {
	return !stats.isOpaque && stats.channels[3];
};

const isFmv = (filename) => {
	for (let i = 0; i < fmvList.length; i++) {	

		if (filename.includes(fmvList[i])) {
			return true;
		}
	}

	return false
};

const processImage = async (file, filePath) => {
	if (ignoreList.includes(file)) {
		console.log(`ignored file found: ${file}`);
		fs.renameSync(filePath, `${outputPath}/ignored/${file}`);
		return;
	}

	// Allow users to manually exclude files from these rules
	// Handy for textures that match the fmv resolutions that aren't actually FMV frames
	if (!includeList.includes(file)) {
		// remove mipmaps
		if (file.includes('_mip')) {
			console.log(`mipmap found, removing: ${file}`);
			fs.unlinkSync(filePath);
			return;
		}

		// remove fmv resolution textures
		if (isFmv(file)) {
			console.log(`fmv found, moving: ${file}`);
			// fs.unlinkSync(filePath);
			fs.copyFileSync(filePath, `${outputPath}/fmv/${file}`);
			return;
		}
	}

	const stats = await sharp(filePath).stats();

	// Delete single color textures
	if (isMonoColor(stats)) {
		console.log(`single color image found, removing: ${file}`);
		fs.unlinkSync(filePath);
		return;
	}

	if (hasAlphaChannel(stats)) {
		console.log(`image with alpha channel found: ${file}`);
		const metadata = await sharp(filePath).metadata();

		// Upscale then downscale alpha channel to create an antialiasing effect
		await sharp(filePath)
			.resize({ width: metadata.width * 4, kernel: 'lanczos3' })
			.extractChannel(3)
			.toFile(`${outputPath}/alphachannel/a-${file}`);

		await sharp(`${outputPath}/alphachannel/a-${file}`)
			.resize({ width: metadata.width, kernel: 'lanczos3' })
			.greyscale()
			.toFile(`${outputPath}/alphachannel/${file}`);

		fs.unlinkSync(`${outputPath}/alphachannel/a-${file}`);

		await sharp(filePath)
			.removeAlpha()
			.toFile(`${outputPath}/alpha/${file}`);

		return;
	} else {
		console.log(`image without alpha found: ${file}`);
		fs.copyFileSync(filePath, `${outputPath}/nonalpha/${file}`);
	}
};

const main = async () => {
	const files = fs.readdirSync(folderPath);

	console.log(`Processing ${files.length} textures.`)

	let file;
	for (let i = 0; i < files.length; i++) {
		file = files[i];

		const filePath = `${folderPath}/${file}`;

		await processImage(file, filePath);
	}
};

main()
.then(() => esrganNonalpha());
