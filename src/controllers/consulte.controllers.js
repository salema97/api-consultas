const { chromium } = require("playwright");

let browser;

const initializeBrowser = async () => {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-gpu",
        "--start-maximized",
        "--blink-settings=imagesEnabled=false",
        "--disable-extensions",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });
  }
};

const ConsultaAduna = async (req, res) => {
  const cedula = req.body.cedula;
  const url = "https://www.aduana.gob.ec/consultacupos/";
  const TIMEOUT_MS = 10000;

  await initializeBrowser();
  const page = await browser.newPage();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(async () => {
      await page.close();
      reject(new Error("Consulta excedió el tiempo límite"));
    }, TIMEOUT_MS);
  });

  const consultaPromise = (async () => {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.click("#exampleRadios1");
      await page.fill("#txtCedula", cedula);
      await page.click("text=Consultar");
      await page.waitForSelector("#dato_cedula");

      const ced = await page.textContent("#dato_cedula");
      const nombre = await page.textContent("#dato_nombre");

      const basicDate = {
        cedula: ced,
        nombre: nombre,
      };

      await page.close();
      return basicDate;
    } catch (error) {
      throw error;
    }
  })();

  try {
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    res.json(result);
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    if (!page.isClosed()) {
      await page.close();
    }
    res.status(500).json({ error: error.message });
  }
};

process.on("exit", async () => {
  if (browser) {
    await browser.close();
  }
});

const ConsultaCompania = async (req, res) => {
  const cedula = req.body.cedula;
  const url =
    "https://appscvs1.supercias.gob.ec/consultaPersona/consulta_cia_param.zul";
  const TIMEOUT_MS = 15000;

  await initializeBrowser();
  const page = await browser.newPage();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(async () => {
      await page.close();
      reject(new Error("Consulta excedió el tiempo límite"));
    }, TIMEOUT_MS);
  });

  const consultaPromise = (async () => {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.click('label:text("Identificación")');
      const cedulaInput = await page.waitForSelector(".z-combobox-inp");
      await cedulaInput.fill(cedula);
      await cedulaInput.press("Backspace");

      const tablaSelector = ".z-comboitem-text";
      await page.waitForTimeout(800);

      if (await page.isVisible(tablaSelector)) {
        await page.waitForSelector(tablaSelector);
        await page.click(tablaSelector);

        await page.click(".z-button");
        await page.waitForSelector(".z-listitem");

        const listItem = await page.waitForSelector(
          '//tr[@class="z-listitem"]/td[@class="z-listcell"]/div/span[@class="z-label"]'
        );
        await listItem.click();

        const [newPage] = await Promise.all([page.waitForEvent("popup")]);

        await newPage.waitForLoadState("domcontentloaded");
        await newPage.goto(newPage.url());

        await newPage.waitForTimeout(1200);

        const parteConstante = "frmInformacionCompanias:j_idt";
        const elementos = await newPage.$$(`
          //input[contains(@id, "${parteConstante}") and contains(@id, "j_idt")]
        `);

        const valoresElementos = [];
        for (const elemento of elementos) {
          const valor = await elemento.getAttribute("value");
          valoresElementos.push(valor);
        }

        const resultDict = {
          ruc: valoresElementos[1],
          fecha_constitucion: valoresElementos[2],
          nacionalidad: valoresElementos[3],
          detalle_ubicacion: {
            provincia: valoresElementos[6]?.trim(),
            canton: valoresElementos[7]?.trim(),
            ciudad: valoresElementos[8]?.trim(),
            parroquia: valoresElementos[9]?.trim(),
            calle: valoresElementos[10]?.trim(),
          },
          detalle_contacto: {
            celular: valoresElementos[23],
            telefono_1: valoresElementos[24]?.trim(),
            correo_1: valoresElementos[27]?.trim(),
            correo_2: valoresElementos[28]?.trim(),
          },
        };

        await newPage.close();
        res.json(resultDict);
      } else {
        res.json({});
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({});
    } finally {
      await page.close();
    }
  })();

  try {
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    res.json(result);
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    res.status(500).json({ error: error.message });
  }
};

process.on("exit", async () => {
  if (browser) {
    await browser.close();
  }
});

const ConsultaPredial = async (req, res) => {
  const cedula = req.body.cedula;
  const url = "http://186.46.158.7/portal_EC/latacunga.php";
  const TIMEOUT_MS = 15000;

  await initializeBrowser();
  const page = await browser.newPage();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(async () => {
      await page.close();
      reject(new Error("Consulta excedió el tiempo límite"));
    }, TIMEOUT_MS);
  });

  const consultaPromise = (async () => {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await page.waitForSelector("#map");
      await page.evaluate(() => {
        const mapElement = document.querySelector("#map");
        if (mapElement) mapElement.remove();
      });

      await page.click("text=Cedula/Ruc");
      await page.fill('input[placeholder="2. Ingrese información"]', cedula);
      await page.click("text=Buscar");

      await page.waitForTimeout(200);

      if (!(await page.isVisible(".swal2-header"))) {
        await page.waitForSelector("#prediosCiu");
        await page.waitForSelector("#rpt_prediocatas1");

        const htmlContent = await page.content();
        const { JSDOM } = require("jsdom");
        const { window } = new JSDOM(htmlContent);
        const { document } = window;

        const datosCiu = [
          ...document.querySelectorAll("#prediosCiu tr td:first-child"),
        ]
          .map((td) => td.textContent.trim())
          .slice(1);

        const datosPredio = [
          ...document.querySelectorAll("#rpt_prediocatas1"),
        ].map((element) => element.textContent.trim());

        await page.close();
        return res.json(generarJsonPredial(datosPredio, datosCiu));
      } else {
        await page.close();
        return res.json({});
      }
    } catch (error) {
      if (!page.isClosed()) {
        await page.close();
      }
      throw error;
    }
  })();

  try {
    const result = await Promise.race([consultaPromise, timeoutPromise]);
    return result;
  } catch (error) {
    console.error("Error durante la consulta:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

const generarJsonPredial = (dataList, numList) => {
  if (dataList.length !== 0) {
    const claveCatastralData = dataList[0] || "";
    const claveCatastralMatch = claveCatastralData.match(
      /CLAVE CATASTRAL:\s*([^\s]+)/
    );
    const zonaMatch = claveCatastralData.match(/ZONA:\s*([^\s]+)/);
    const areaMatch = claveCatastralData.match(/AREA\(m2\):\s*([^\s]+)/);
    const areaConstruccionMatch = claveCatastralData.match(
      /AREA CONSTRUCCION:\s*([^\s]+)/
    );
    const perimetroMatch = claveCatastralData.match(/PERIMETRO:\s*([^\s]+)/);
    const direccionMatch = claveCatastralData.match(
      /DIRECCION:\s*(.*?)\s*ZONIFICACION/
    );
    const usoPredioMatch = claveCatastralData.match(
      /Uso Predio:\s*(.*?)(Lote:|$)/
    );

    let direccion = direccionMatch ? direccionMatch[1].trim() : "";
    direccion = direccion.replace("Foto del Predio", "").trim();

    const datosPredial = {
      totalTerrenos: numList.length,
      predioPrincipal: {
        claveCatastral: claveCatastralMatch ? claveCatastralMatch[1] : "",
        zona: zonaMatch ? zonaMatch[1] : "",
        area_m2: areaMatch ? areaMatch[1] : "",
        areaConstruccion: areaConstruccionMatch ? areaConstruccionMatch[1] : "",
        perimetro: perimetroMatch ? perimetroMatch[1] : "",
        direccion: direccion,
        usoPredio: usoPredioMatch ? usoPredioMatch[1].trim() : "",
      },
    };

    return datosPredial;
  }

  return {};
};

module.exports = { ConsultaAduna, ConsultaCompania, ConsultaPredial };
