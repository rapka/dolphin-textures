const fs = require('fs');
const sharp = require('sharp');

const gameKey = process.argv[2].toUpperCase();

let ignoreList = [];
let includeList = [];

if (fs.existsSync(`ignore/${gameKey}.txt`)) {
	ignoreList = fs.readFileSync(`ignore/${gameKey}.txt`).toString().split('\n');
}

if (fs.existsSync(`include/${gameKey}.txt`)) {
	includeList = fs.readFileSync(`include/${gameKey}.txt`).toString().split('\n');
}

const main = async () => {
	const folderPath = `${__dirname}/${gameKey}`;
	const files = fs.readdirSync(folderPath);

	console.log(`Processing ${files.length} textures.`)

	let file;
	for (let i = 0; i < files.length; i++) {
		file = files[i];

		const filePath = `${folderPath}/${file}`;

		await processImage(file, filePath);
	}
}

const isMonoColor = (stats) => {
	return stats.channels[0].min === stats.channels[0].max &&
		stats.channels[1].min === stats.channels[1].max &&
		stats.channels[2].min === stats.channels[2].max &&
		(!stats.channels[3] || (stats.channels[3].min === stats.channels[3].max))
};

const hasAlphaChannel = (stats) => {
	return !stats.isOpaque && stats.channels[3];
};

const processImage = async (file, filePath) => {
	if (ignoreList.includes(file)) {
		console.log(`ignored file found: ${file}`);
		fs.renameSync(filePath, `${__dirname}/ignored/${file}`);
		return;
	}

	// remove mipmaps
	if (!includeList.includes(file)) {
		if (file.includes('_mip')) {
			console.log(`mipmap found, removing: ${file}`);
			fs.unlinkSync(filePath);
			return;
		}

		// remove fmv resolution textures
		if (file.includes('320x240') ||
			file.includes('640x480') ||
			file.includes('642x450') ||
			file.includes('640x448')) {
			console.log(`fmv found, removing: ${file}`);
			// fs.unlinkSync(filePath);
			fs.renameSync(filePath, `${__dirname}/fmv/${file}`);
			return;
		}
	}

	const stats = await sharp(filePath).stats();

	if (isMonoColor(stats)) {
		console.log(`single color image found: ${file}`);
		fs.unlinkSync(filePath);
		return;
	}

	if (hasAlphaChannel(stats)) {
		console.log(`image with alpha channel found: ${file}`);
		const metadata = await sharp(filePath).metadata();

		// Uncomment these to enable alpha channel splitting
		// await sharp(filePath)
		// 	.resize({ width: metadata.width * 4 })
		// 	.extractChannel(3)
		// 	.toFile(`${__dirname}/alphachannel/${file}`);

		// await sharp(filePath)
		// 	.removeAlpha()
		// 	.toFile(`${__dirname}/alphaflattened/${file}`);

		fs.renameSync(filePath, `${__dirname}/alpha/${file}`);

		return;
	} else {
		console.log(`image without alpha found: ${file}`)
		fs.renameSync(filePath, `${__dirname}/nonalpha/${file}`);
	}
};

main().then(() => console.log('Done.'));
