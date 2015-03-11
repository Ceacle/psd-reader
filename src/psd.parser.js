
PsdReader.prototype.parser = function(buffer) {

	var me = this,
		view = new DataView(buffer),
		pos = 0,
		magic = getFourCC(),
		version = getUint16(),
		reserved, i,
		channels,
		compression, compDesc,
		width, height, depth, mode, modeDesc,
		colChunk, iresChunk, layersChunk,
		startTime = performance ? performance.now() : Date.now(),
		info = {
			maxCompatibility: true,
			width           : 0,
			height          : 0,
			channels        : 0,
			depth           : 0,
			byteWidth       : 0,
			colorMode       : 0,
			colorDesc       : "",
			compression     : 0,
			compressionDesc : "",
			channelSize     : 0,
			chunks          : [],
			resources       : [],
			layers          : [],
			bitmaps         : []
		};

	this.info = info;
	this.rgba = null;

	// check magic header keyword
	if (magic !== "8BPS" && version !== 1) {
		this._err("Not PSD file.", "parser");
		return
	}

	// check reserved space
	for(reserved = getChars(6), i = 0; i < 6; i++) if (reserved[i]) {
		this._err("Not a valid PSD file.", "parser");
		return
	}

	addChunk("Header", 14);

	channels = getUint16();
	if (channels < 1 || channels > 56) {
		this._err("Invalid channel count.", "parser");
		return
	}

	height = getUint32();		// note: height comes before width
	width = getUint32();
	if (width < 1 || width > 30000 || height < 1 || height > 30000) {
		this._err("Invalid size.", "parser");
		return
	}

	depth = getUint16();
	if ([1,8,16,32].indexOf(depth) < 0) {
		this._err("Invalid depth.", "parser");
		return
	}

	mode = getUint16();
	if (mode < 0 || mode > 15) {
		this._err("Invalid color mode.", "parser");
		return
	}
	modeDesc = ["Bitmap", "Greyscale", "Indexed", "RGB", "CMYK", "HSL", "HSB",
				"Multichannel", "Duotone", "Lab", "Greyscale16", "RGB48","LAB48",
				"CMYK64","DeepMultichannel","Duotone16"][mode];

	// store as public info object
	info.channels = channels;
	info.width = width;
	info.height = height;
	info.depth = depth;
	info.byteWidth = depth / 8;
	info.colorMode = mode;
	info.colorDesc = modeDesc;
	info.channelSize = width * height * info.byteWidth;

	// Color Mode Data, will be 0 for most mode except indexed and duotone
	colChunk = getUint32();
	addChunk("ColorModeData", colChunk);
	pos += colChunk;

	if ((mode === 2 || mode === 8) && colChunk === 0) {
		this._err("Invalid size for PSD file.", "parser");
		return
	}

	if (mode === 3) {
		// indexed color table (currently no proper documentation on order/format...)
	}
	else if (mode === 8) {
		// duo tone data (currently no documentation)
	}

	// Image Resource section
	iresChunk = getUint32();
	addChunk("ImageResource", iresChunk);
	pos += iresChunk;

	// Layers and Mask section
	layersChunk = getUint32();
	addChunk("LayersAndMasks", layersChunk);
	pos += layersChunk;

	// Image Data section
	addChunk("ImageData", view.buffer.byteLength - pos);
	compression = getUint16();
	compDesc = ["Uncompressed", "RLE", "ZIP (no prediction)", "ZIP"][compression];

	info.compression = compression;
	info.compressionDesc = compDesc;

	switch(compression) {
		case 0:	// _raw
			this._raw(view, pos, info, convert);
			break;
		case 1:	// rle
			this._rle(view, pos, info, convert);
			break;
		case 2:	// zip no-prediction - possibly LZ77 stream.. no test files to be found...
		case 3:	// zip
			console.warn("If you come across this, consider sending us a specimen of this file for analysis.");
			break;
	}

	function convert() {me._toRGBA(cbLoad)}
	function cbLoad(bmp) {
		me.rgba = bmp;
		if (me.onload) me.onload({
			timeStamp: Date.now(),
			elapsed: (performance ? performance.now() : Date.now()) - startTime
		})
	}

	/*
	Helpers
	 */
	function addChunk(name, length) {
		info.chunks.push({
			pos: pos,
			name: name,
			length: length
		})
	}

	/*function getUint8() {return view.getUint8(pos++)}*/
	/*function getInt8() {return view.getInt8(pos++)}*/

	function getUint16() {
		var v = view.getUint16(pos);
		pos += 2;
		return v>>>0;
	}

	/*function getInt16() {
		var v = view.getInt16(pos);
		pos += 2;
		return v;
	}*/

	function getUint32() {
		var v = view.getUint32(pos);
		pos += 4;
		return v>>>0;
	}

	/*function getInt32() {
		var v = view.getInt32(pos);
		pos += 4;
		return v;
	}*/

	function getChars(len) {
		var chars = new Uint8Array(buffer, pos, len);
		pos += len;
		return chars
	}

	/*function getString2(max) {

		var str = "", ch = -1, i = 0;

		while(i++ < max && ch) {
			ch = getUint8();
			if (!ch) str += String.fromCharCode(ch);
		}

		if (!str.length || str.length % 2 === 0) pos++;

		return str
	}*/

	function getFourCC(lsb) {
		var v = getUint32(),
			c = String.fromCharCode;

		return	lsb ?
				  c((v & 0xff)>>>0) + c((v & 0xff00)>>>8) + c((v & 0xff0000)>>>16) + c((v & 0xff000000)>>>24)
				  :
				  c((v & 0xff000000)>>>24) + c((v & 0xff0000)>>>16) + c((v & 0xff00)>>>8) + c((v & 0xff)>>>0);
	}
};