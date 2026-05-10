const CORES = ['#6366f1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#F97316']

function corIniciais(nome) {
  return CORES[(nome?.charCodeAt(0) || 0) % CORES.length]
}

function iniciais(nome) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase()
}

export function redimensionarImagem(file, maxSize = 200) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > height) {
        if (width > maxSize) { height = Math.round((height / width) * maxSize); width = maxSize }
      } else {
        if (height > maxSize) { width = Math.round((width / height) * maxSize); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.src = url
  })
}

export function Avatar({ nome, fotoPerfil, size = 40, onClick, title }) {
  return (
    <div
      className="rounded-full flex-shrink-0 overflow-hidden select-none"
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: corIniciais(nome),
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      title={title}
    >
      {fotoPerfil ? (
        <img
          src={fotoPerfil}
          alt={nome || ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: Math.round(size * 0.38),
            letterSpacing: '0.01em',
          }}
        >
          {iniciais(nome)}
        </div>
      )}
    </div>
  )
}
