import * as React from 'react'
import type { ComponentEntry } from './types'
import { DragDropManager } from '@dnd-kit/dom'
import { Sortable } from '@dnd-kit/dom/sortable'
import './todos.css'

function VerticalTodoSortableSample() {
  const mountRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!mountRef.current) return

    const manager = new DragDropManager()
    const wrapper = document.createElement('ul')
    const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4']

    wrapper.classList.add('list')

    items.forEach((item, index) => {
      const element = document.createElement('li')
      const box = document.createElement('span')
      const label = document.createElement('span')

      element.classList.add('item')
      box.classList.add('box')
      label.innerText = item

      element.appendChild(box)
      element.appendChild(label)

      new Sortable({
        id: item,
        index,
        element,
      }, manager)

      wrapper.appendChild(element)
    })

    mountRef.current.appendChild(wrapper)

    return () => {
      if (mountRef.current) {
        mountRef.current.innerHTML = ''
      }
    }
  }, [])

  return (
    <div className="todo-sample-root">
      <div ref={mountRef} />
    </div>
  )
}

export const todosComponents: ComponentEntry[] = [
  {
    id: 'vertical-todo-sortable-sample',
    name: 'Vertical Todo Sortable',
    category: 'Todos',
    description: 'Exact sample port with vertical orientation and checkbox box.',
    component: VerticalTodoSortableSample,
    props: [],
    mockData: () => ({}),
  },
]
