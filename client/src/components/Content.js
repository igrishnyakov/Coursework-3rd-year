import { Route, Routes } from 'react-router-dom'
import News from './pages/News'
import Events from './pages/Events'
import CrudExample from './pages/CrudExample'
import Reports from './pages/Reports'

function Content(props) {
    return (
        <>
            <div className='content-wrapper'>
                <div className='content'>
                    <Routes>
                        <Route path='/' element={<News currentUserInfo={props.currentUserInfo} />} />
                        <Route path='/events' element={<Events currentUserInfo={props.currentUserInfo}/>} />
                        <Route path='/reports' element={<Reports currentUserInfo={props.currentUserInfo}/>} />
                        <Route path='/crud-example' element={<CrudExample currentUserInfo={props.currentUserInfo} />} />
                    </Routes>
                </div>
            </div>
        </>
    )
}

export default Content