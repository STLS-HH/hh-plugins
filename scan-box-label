$(document).ready(function () {

	// Only run on the scanning app page
	if ($("#scanning_app").length === 0) return;

	// Create the overlay label element
	var boxLabel = $("<div>", {
		id: "box_label_overlay",
		css: {
			position: "absolute",
			zIndex: 9999,
			display: "none",
			textAlign: "center",
			pointerEvents: "none",
			fontWeight: "bold",
			fontSize: "2.2em",
			lineHeight: "1.3",
			color: "#ffffff",
			textShadow: "2px 2px 6px rgba(0,0,0,0.85), -1px -1px 4px rgba(0,0,0,0.6)",
			padding: "10px 20px",
			borderRadius: "12px",
			background: "rgba(0, 0, 0, 0.55)",
			maxWidth: "90%",
			whiteSpace: "normal",
			wordWrap: "break-word",
			left: "50%",
			transform: "translateX(-50%)"
		}
	}).appendTo("body");

	// Reads box name and code from the "Open box" dialog inputs
	function getBoxInfo() {
		var inputs = $("#ui-id-38 input");
		var name = inputs.eq(0).val() || "";
		var code = inputs.eq(1).val() || "";
		return { name: name.trim(), code: code.trim() };
	}

	// Position the label centred over the box image
	function positionLabel() {
		var img = $("#box_open_overlay");
		if (img.length === 0) return;

		var offset = img.offset();
		var imgHeight = img.outerHeight();

		boxLabel.css({
			top: (offset.top + imgHeight * 0.15) + "px"
		});
	}

	// Show the label with box info
	function showBoxLabel() {
		var info = getBoxInfo();

		// Build display text
		var lines = [];
		if (info.name) lines.push(info.name);
		if (info.code) lines.push("[ " + info.code + " ]");

		if (lines.length === 0) {
			// Fallback: try to find from the Boxes grid (pqgrid4)
			// Look at the last scanned code in the footer input
			var scannedCode = $(".scan_code").val();
			if (scannedCode) {
				try {
					var gridData = $("#pqgrid4").pqGrid("option", "dataModel.data");
					for (var i = 0; i < gridData.length; i++) {
						if (gridData[i].barcode == scannedCode) {
							lines.push(gridData[i].title || "");
							lines.push("[ " + gridData[i].barcode + " ]");
							break;
						}
					}
				} catch (e) { }
			}
		}

		if (lines.length === 0) {
			lines.push("Box Open");
		}

		boxLabel.html(lines.join("<br>"));
		positionLabel();
		boxLabel.show();
	}

	// Hide the label
	function hideBoxLabel() {
		boxLabel.hide();
	}

	// Watch the #box_open_overlay image for style changes (display toggling)
	var overlayImg = document.getElementById("box_open_overlay");
	if (overlayImg) {
		var observer = new MutationObserver(function (mutations) {
			mutations.forEach(function (m) {
				if (m.attributeName === "style") {
					var display = overlayImg.style.display;
					if (display === "block" || display === "inline") {
						// Small delay to let HireHop finish updating the dialog inputs
						setTimeout(showBoxLabel, 150);
					} else {
						hideBoxLabel();
					}
				}
			});
		});

		observer.observe(overlayImg, { attributes: true, attributeFilter: ["style"] });

		// Also check initial state in case page loads with box already open
		var initialDisplay = overlayImg.style.display;
		if (initialDisplay === "block" || initialDisplay === "inline") {
			setTimeout(showBoxLabel, 500);
		}
	}

	// Reposition on window resize
	$(window).on("resize", function () {
		if (boxLabel.is(":visible")) {
			positionLabel();
		}
	});

});
