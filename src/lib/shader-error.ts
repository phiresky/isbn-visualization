// https://github.com/Mugen87/three.js/blob/a94de2aa8b2ef1830adeea3be5d1d1eca5b6e1f4/src/renderers/webgl/WebGLProgram.js
function handleSource(string: string, errorLine: number) {
  const lines = string.split("\n");
  const lines2 = [];

  const from = Math.max(errorLine - 6, 0);
  const to = Math.min(errorLine + 6, lines.length);

  for (let i = from; i < to; i++) {
    const line = i + 1;
    lines2.push(`${line === errorLine ? ">" : " "} ${line}: ${lines[i]}`);
  }

  return lines2.join("\n");
}

function getShaderErrors(
  gl: WebGLRenderingContext,
  shader: WebGLShader,
  type: string,
) {
  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as string;
  const log = gl.getShaderInfoLog(shader);
  if (!log) return "";
  const errors = log.trim();

  if (status && errors === "") return "";

  const errorMatches = /ERROR: 0:(\d+)/.exec(errors);
  if (errorMatches) {
    // --enable-privileged-webgl-extension
    // console.log( '**' + type + '**', gl.getExtension( 'WEBGL_debug_shaders' ).getTranslatedShaderSource( shader ) );
    const source = gl.getShaderSource(shader);
    if (!source) return errors;
    const errorLine = parseInt(errorMatches[1]);
    return (
      type.toUpperCase() +
      "\n\n" +
      errors +
      "\n\n" +
      handleSource(source, errorLine)
    );
  } else {
    return errors;
  }
}

export const shaderErrorToString = (
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  glVertexShader: WebGLShader,
  glFragmentShader: WebGLShader,
) => {
  const programLog = gl.getProgramInfoLog(program)?.trim();
  const vertexErrors = getShaderErrors(gl, glVertexShader, "vertex");
  const fragmentErrors = getShaderErrors(gl, glFragmentShader, "fragment");

  const err =
    "THREE.WebGLProgram: Shader Error " +
    String(gl.getError()) +
    " - " +
    "VALIDATE_STATUS " +
    String(gl.getProgramParameter(program, gl.VALIDATE_STATUS)) +
    "\n\n" +
    "Program Info Log: " +
    String(programLog) +
    "\n" +
    vertexErrors +
    "\n" +
    fragmentErrors;

  return err;
};
